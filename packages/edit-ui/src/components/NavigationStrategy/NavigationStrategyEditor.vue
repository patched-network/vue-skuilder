<template>
  <div class="navigation-strategy-editor">
    <div v-if="loading">
      <v-progress-circular indeterminate color="secondary"></v-progress-circular>
    </div>
    <div v-else>
      <h2 class="text-h5 mb-4">Navigation Strategies</h2>

      <div v-if="strategies.length === 0" class="no-strategies">
        <p>No navigation strategies defined for this course.</p>
      </div>

      <navigation-strategy-list
        v-else
        :strategies="strategies"
        :default-strategy-id="defaultStrategyId"
        @update:default-strategy="setDefaultStrategy"
        @edit="editStrategy"
        @delete="confirmDeleteStrategy"
      />

      <v-btn color="primary" class="mt-4" @click="openCreateDialog">
        <v-icon start>mdi-plus</v-icon>
        Add New Strategy
      </v-btn>

      <v-dialog v-model="showCreateDialog" max-width="800px">
        <v-card>
          <v-card-title>Create New Navigation Strategy</v-card-title>
          <v-card-text>
            <v-select
              v-model="newStrategy.type"
              label="Strategy Type"
              :items="strategyTypes"
              item-title="label"
              item-value="value"
              required
              class="mb-4"
            ></v-select>

            <v-text-field v-model="newStrategy.name" label="Strategy Name" required></v-text-field>
            <v-text-field v-model="newStrategy.description" label="Description" required></v-text-field>

            <!-- Strategy-specific configuration forms -->
            <hardcoded-order-config-form
              v-if="newStrategy.type === 'hardcoded'"
              v-model="newStrategy.config"
            />

            <hierarchy-config-form
              v-else-if="newStrategy.type === 'hierarchy'"
              v-model="newStrategy.config"
              :course-id="courseId"
            />

            <!-- Placeholder for other strategy types -->
            <v-alert v-else type="info" density="compact">
              Configuration form for {{ newStrategy.type }} strategy coming soon.
            </v-alert>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="blue darken-1" text @click="showCreateDialog = false">Cancel</v-btn>
            <v-btn color="blue darken-1" text @click="saveNewStrategy">Save</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="showDeleteConfirm" max-width="400px">
        <v-card>
          <v-card-title class="text-h5">Delete Strategy</v-card-title>
          <v-card-text> Are you sure you want to delete the strategy "{{ strategyToDelete?.name }}"? </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="error" @click="deleteStrategy">Delete</v-btn>
            <v-btn @click="showDeleteConfirm = false">Cancel</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { ContentNavigationStrategyData } from '@vue-skuilder/db/src/core/types/contentNavigationStrategy';
import NavigationStrategyList from './NavigationStrategyList.vue';
import HardcodedOrderConfigForm from './HardcodedOrderConfigForm.vue';
import HierarchyConfigForm from './HierarchyConfigForm.vue';
import { getDataLayer, DocType, Navigators } from '@vue-skuilder/db';
import { DocTypePrefixes } from '@vue-skuilder/db/src/core/types/types-legacy';

export default defineComponent({
  name: 'NavigationStrategyEditor',

  components: {
    NavigationStrategyList,
    HardcodedOrderConfigForm,
    HierarchyConfigForm,
  },

  props: {
    courseId: {
      type: String,
      required: true,
    },
  },

  data() {
    return {
      strategies: [] as ContentNavigationStrategyData[],
      loading: true,
      showDeleteConfirm: false,
      strategyToDelete: null as ContentNavigationStrategyData | null,
      showCreateDialog: false,
      strategyTypes: [
        { label: 'Hardcoded Order', value: 'hardcoded' },
        { label: 'Hierarchy Definition', value: 'hierarchy' },
        { label: 'Interference Mitigator', value: 'interference' },
        { label: 'Relative Priority', value: 'relativePriority' },
      ],
      newStrategy: {
        type: 'hardcoded' as string,
        name: '',
        description: '',
        config: { cardIds: [] } as any, // Type varies by strategy type
      },
      defaultStrategyId: null as string | null,
    };
  },

  async created() {
    await this.loadStrategies();
  },

  watch: {
    'newStrategy.type'(newType: string) {
      // Reset config when strategy type changes
      this.newStrategy.config = this.getDefaultConfig(newType);
    },
  },

  methods: {
    getDefaultConfig(strategyType: string) {
      switch (strategyType) {
        case 'hardcoded':
          return { cardIds: [] };
        case 'hierarchy':
          return {
            prerequisites: {},
            delegateStrategy: 'elo',
          };
        case 'interference':
          return {
            interferenceSets: [],
            maturityThreshold: {
              minCount: 10,
              minElapsedDays: 3,
            },
            defaultDecay: 0.8,
            delegateStrategy: 'elo',
          };
        case 'relativePriority':
          return {
            tagPriorities: {},
            defaultPriority: 0.5,
            combineMode: 'max',
            priorityInfluence: 0.5,
            delegateStrategy: 'elo',
          };
        default:
          return {};
      }
    },

    async loadStrategies() {
      this.loading = true;
      try {
        const dataLayer = getDataLayer();
        const courseDB = dataLayer.getCourseDB(this.courseId);

        // Get all navigation strategies and the course config in parallel
        const [strategies, courseConfig] = await Promise.all([
          courseDB.getAllNavigationStrategies(),
          courseDB.getCourseConfig(),
        ]);

        this.strategies = strategies;
        this.defaultStrategyId = courseConfig.defaultNavigationStrategyId || null;
      } catch (error) {
        console.error('Failed to load navigation strategies:', error);
        // In case of error, use a placeholder
        this.strategies = [
          {
            _id: `NAVIGATION_STRATEGY-ELO`,
            docType: DocType.NAVIGATION_STRATEGY,
            name: 'ELO',
            description: 'Default ELO-based navigation strategy',
            implementingClass: Navigators.ELO,
            course: this.courseId,
            serializedData: '',
            author: 'system',
          },
        ];
      }
      this.loading = false;
    },

    async setDefaultStrategy(strategyId: string) {
      try {
        this.loading = true;
        const dataLayer = getDataLayer();
        const courseDB = dataLayer.getCourseDB(this.courseId);
        const config = await courseDB.getCourseConfig();

        config.defaultNavigationStrategyId = strategyId;

        await courseDB.updateCourseConfig(config);
        this.defaultStrategyId = strategyId;
        alert('Default strategy updated!');
      } catch (error) {
        console.error('Failed to set default strategy:', error);
        alert('Error updating default strategy. See console for details.');
      } finally {
        this.loading = false;
      }
    },

    openCreateDialog() {
      const defaultType = 'hardcoded';
      this.newStrategy = {
        type: defaultType,
        name: '',
        description: '',
        config: this.getDefaultConfig(defaultType),
      };
      this.showCreateDialog = true;
    },

    async saveNewStrategy() {
      if (!this.newStrategy.name) {
        alert('Strategy Name is required.');
        return;
      }

      // Validate config based on strategy type
      if (this.newStrategy.type === 'hardcoded' && this.newStrategy.config.cardIds.length === 0) {
        alert('At least one card ID is required for hardcoded order strategy.');
        return;
      }

      if (this.newStrategy.type === 'hierarchy') {
        const prereqCount = Object.keys(this.newStrategy.config.prerequisites || {}).length;
        if (prereqCount === 0) {
          alert('At least one prerequisite rule is required for hierarchy strategy.');
          return;
        }
      }

      this.loading = true;
      try {
        const dataLayer = getDataLayer();
        const userDB = dataLayer.getUserDB();
        const userName = userDB.getUsername();
        const courseDB = dataLayer.getCourseDB(this.courseId);

        // Map strategy type to implementing class
        const implementingClassMap: Record<string, string> = {
          hardcoded: Navigators.HARDCODED,
          hierarchy: Navigators.HIERARCHY,
          interference: Navigators.INTERFERENCE,
          relativePriority: Navigators.RELATIVE_PRIORITY,
        };

        // Serialize config based on strategy type
        let serializedData: string;
        if (this.newStrategy.type === 'hardcoded') {
          // Hardcoded stores just the array of card IDs
          serializedData = JSON.stringify(this.newStrategy.config.cardIds);
        } else {
          // Other strategies store their full config object
          serializedData = JSON.stringify(this.newStrategy.config);
        }

        const strategyData: ContentNavigationStrategyData = {
          _id: `NAVIGATION_STRATEGY-${Date.now()}`,
          docType: DocType.NAVIGATION_STRATEGY,
          name: this.newStrategy.name,
          description: this.newStrategy.description,
          implementingClass: implementingClassMap[this.newStrategy.type],
          author: userName,
          course: this.courseId,
          serializedData,
        };

        await courseDB.addNavigationStrategy(strategyData);

        this.showCreateDialog = false;
        await this.loadStrategies(); // Refresh the list
      } catch (error) {
        console.error('Failed to save new strategy:', error);
        alert('Error saving strategy. See console for details.');
      }
      this.loading = false;
    },

    editStrategy(strategy: ContentNavigationStrategyData) {
      // Strategy editing is not yet implemented
      console.log(`Editing strategy ${strategy._id} is not yet implemented`);
    },

    confirmDeleteStrategy(strategy: ContentNavigationStrategyData) {
      this.strategyToDelete = strategy;
      this.showDeleteConfirm = true;
    },

    async deleteStrategy() {
      if (!this.strategyToDelete) return;

      this.loading = true;
      try {
        const dataLayer = getDataLayer();
        const courseDB = dataLayer.getCourseDB(this.courseId);

        // Since deleteNavigationStrategy doesn't exist in the interface yet,
        // we'll use updateNavigationStrategy with an empty/invalid strategy that
        // will be ignored by the system
        const emptyStrategy: ContentNavigationStrategyData = {
          _id: this.strategyToDelete!._id,
          docType: DocType.NAVIGATION_STRATEGY,
          name: 'DELETED',
          description: 'This strategy has been deleted',
          implementingClass: '',
          course: this.courseId,
          serializedData: '',
        };

        // Update with empty strategy
        await courseDB.updateNavigationStrategy(this.strategyToDelete!._id, emptyStrategy);
        console.log(`Strategy ${this.strategyToDelete!._id} marked as deleted`);

        // Remove from our local array
        this.strategies = this.strategies.filter((s) => s._id !== this.strategyToDelete?._id);

        this.showDeleteConfirm = false;
        this.strategyToDelete = null;
      } catch (error) {
        console.error('Failed to delete navigation strategy:', error);
      }
      this.loading = false;
    },
  },
});
</script>

<style scoped>
.navigation-strategy-editor {
  padding: 16px;
}

.no-strategies {
  margin: 20px 0;
  padding: 20px;
  background-color: #f5f5f5;
  border-radius: 4px;
  text-align: center;
}
</style>
