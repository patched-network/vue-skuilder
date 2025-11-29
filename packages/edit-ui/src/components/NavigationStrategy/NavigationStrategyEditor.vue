<template>
  <div class="navigation-strategy-editor">
    <div v-if="loading" class="text-center pa-4">
      <v-progress-circular indeterminate color="secondary"></v-progress-circular>
    </div>
    <div v-else class="editor-layout">
      <!-- Left Column: Strategy List -->
      <div class="strategy-list-column">
        <div class="d-flex align-center mb-2">
          <h3 class="text-h6">Strategies</h3>
          <v-spacer></v-spacer>
          <v-btn size="small" color="primary" @click="startNewStrategy" density="compact">
            <v-icon start size="small">mdi-plus</v-icon>
            New
          </v-btn>
        </div>

        <v-alert v-if="strategies.length === 0" type="info" density="compact">
          No strategies defined
        </v-alert>

        <navigation-strategy-list
          v-else
          :strategies="strategies"
          :default-strategy-id="defaultStrategyId"
          @update:default-strategy="setDefaultStrategy"
          @edit="editStrategy"
          @delete="confirmDeleteStrategy"
        />
      </div>

      <!-- Right Column: Strategy Form -->
      <div class="strategy-form-column">
        <div class="form-header d-flex align-center mb-3">
          <h3 class="text-h6">{{ editingStrategy ? 'Edit Strategy' : 'New Strategy' }}</h3>
          <v-spacer></v-spacer>
          <v-btn
            v-if="editingStrategy"
            size="small"
            variant="text"
            @click="cancelEdit"
            density="compact"
          >
            Cancel
          </v-btn>
        </div>

        <v-select
          v-model="newStrategy.type"
          label="Type"
          :items="strategyTypes"
          item-title="label"
          item-value="value"
          density="compact"
          class="mb-3"
        ></v-select>

        <v-text-field
          v-model="newStrategy.name"
          label="Name"
          density="compact"
          class="mb-3"
        ></v-text-field>

        <v-text-field
          v-model="newStrategy.description"
          label="Description"
          density="compact"
          class="mb-3"
        ></v-text-field>

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

        <interference-config-form
          v-else-if="newStrategy.type === 'interference'"
          v-model="newStrategy.config"
          :course-id="courseId"
        />

        <relative-priority-config-form
          v-else-if="newStrategy.type === 'relativePriority'"
          v-model="newStrategy.config"
          :course-id="courseId"
        />

        <v-alert v-else type="warning" density="compact">
          Unknown strategy type: {{ newStrategy.type }}
        </v-alert>

        <div class="form-actions mt-4">
          <v-btn
            color="primary"
            @click="saveStrategy"
            :disabled="!newStrategy.name"
            size="small"
          >
            {{ editingStrategy ? 'Update' : 'Create' }}
          </v-btn>
          <v-btn
            v-if="editingStrategy"
            variant="text"
            @click="cancelEdit"
            size="small"
          >
            Cancel
          </v-btn>
        </div>
      </div>

      <!-- Delete Confirmation (still a dialog, but small) -->
      <v-dialog v-model="showDeleteConfirm" max-width="400px">
        <v-card>
          <v-card-title class="text-subtitle-1">Delete Strategy</v-card-title>
          <v-card-text>Delete "{{ strategyToDelete?.name }}"?</v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn size="small" @click="showDeleteConfirm = false">Cancel</v-btn>
            <v-btn size="small" color="error" @click="deleteStrategy">Delete</v-btn>
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
import InterferenceConfigForm from './InterferenceConfigForm.vue';
import RelativePriorityConfigForm from './RelativePriorityConfigForm.vue';
import { getDataLayer, DocType, Navigators } from '@vue-skuilder/db';

export default defineComponent({
  name: 'NavigationStrategyEditor',

  components: {
    NavigationStrategyList,
    HardcodedOrderConfigForm,
    HierarchyConfigForm,
    InterferenceConfigForm,
    RelativePriorityConfigForm,
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
        config: { cardIds: [] } as any,
      },
      editingStrategy: null as ContentNavigationStrategyData | null,
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

    // Map implementing class to strategy type
    getStrategyTypeFromClass(implementingClass: string): string {
      switch (implementingClass) {
        case Navigators.HARDCODED:
          return 'hardcoded';
        case Navigators.HIERARCHY:
          return 'hierarchy';
        case Navigators.INTERFERENCE:
          return 'interference';
        case Navigators.RELATIVE_PRIORITY:
          return 'relativePriority';
        default:
          return 'hardcoded';
      }
    },

    // Parse serialized data back to config object
    parseSerializedData(strategyType: string, serializedData: string): any {
      try {
        const parsed = JSON.parse(serializedData);

        if (strategyType === 'hardcoded') {
          // Hardcoded stores just the array, wrap it
          return { cardIds: Array.isArray(parsed) ? parsed : [] };
        } else {
          // Other strategies store the full config object
          return parsed;
        }
      } catch (error) {
        console.error('Failed to parse strategy data:', error);
        return this.getDefaultConfig(strategyType);
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

    startNewStrategy() {
      const defaultType = 'hardcoded';
      this.newStrategy = {
        type: defaultType,
        name: '',
        description: '',
        config: this.getDefaultConfig(defaultType),
      };
      this.editingStrategy = null;
    },

    cancelEdit() {
      this.startNewStrategy();
    },

    editStrategy(strategy: ContentNavigationStrategyData) {
      const strategyType = this.getStrategyTypeFromClass(strategy.implementingClass);
      const config = this.parseSerializedData(strategyType, strategy.serializedData);

      this.newStrategy = {
        type: strategyType,
        name: strategy.name,
        description: strategy.description,
        config,
      };
      this.editingStrategy = strategy;
    },

    async saveStrategy() {
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

      if (this.newStrategy.type === 'interference') {
        if (!this.newStrategy.config.interferenceSets || this.newStrategy.config.interferenceSets.length === 0) {
          alert('At least one interference group is required for interference strategy.');
          return;
        }
      }

      if (this.newStrategy.type === 'relativePriority') {
        if (!this.newStrategy.config.tagPriorities || Object.keys(this.newStrategy.config.tagPriorities).length === 0) {
          alert('At least one tag priority must be set for relative priority strategy.');
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

        if (this.editingStrategy) {
          // Update existing strategy
          const strategyData: ContentNavigationStrategyData = {
            ...this.editingStrategy,
            name: this.newStrategy.name,
            description: this.newStrategy.description,
            implementingClass: implementingClassMap[this.newStrategy.type],
            serializedData,
          };

          await courseDB.updateNavigationStrategy(this.editingStrategy._id, strategyData);
        } else {
          // Create new strategy
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
        }

        await this.loadStrategies(); // Refresh the list
        this.startNewStrategy(); // Reset form
      } catch (error) {
        console.error('Failed to save new strategy:', error);
        alert('Error saving strategy. See console for details.');
      }
      this.loading = false;
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
  height: 100%;
  overflow: hidden;
}

.editor-layout {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 24px;
  height: 100%;
  overflow: hidden;
}

.strategy-list-column {
  overflow-y: auto;
  padding-right: 12px;
}

.strategy-form-column {
  overflow-y: auto;
  padding-left: 12px;
  border-left: 1px solid #e0e0e0;
}

.form-actions {
  display: flex;
  gap: 8px;
}

@media (max-width: 960px) {
  .editor-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .strategy-form-column {
    border-left: none;
    border-top: 1px solid #e0e0e0;
    padding-left: 0;
    padding-top: 12px;
  }
}
</style>
