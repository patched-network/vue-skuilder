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

      <v-dialog v-model="showCreateDialog" max-width="600px">
        <v-card>
          <v-card-title>Create New Navigation Strategy</v-card-title>
          <v-card-text>
            <v-text-field v-model="newStrategy.name" label="Strategy Name" required></v-text-field>
            <v-text-field v-model="newStrategy.description" label="Description" required></v-text-field>
            <v-textarea
              v-model="newStrategy.cardIds"
              label="Card IDs"
              placeholder="Enter card IDs, one per line or separated by commas"
              rows="10"
              required
            ></v-textarea>
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
import { getDataLayer, DocType, Navigators } from '@vue-skuilder/db';

export default defineComponent({
  name: 'NavigationStrategyEditor',

  components: {
    NavigationStrategyList,
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
      newStrategy: {
        name: '',
        description: '',
        cardIds: '',
      },
      defaultStrategyId: null as string | null,
    };
  },

  async created() {
    await this.loadStrategies();
  },

  methods: {
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
        // @ts-expect-error defaultNavigationStrategyId is not yet in the type
        this.defaultStrategyId = courseConfig.defaultNavigationStrategyId || null;

      } catch (error) {
        console.error('Failed to load navigation strategies:', error);
        // In case of error, use a placeholder
        this.strategies = [
          {
            _id: 'ELO',
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

        // @ts-expect-error defaultNavigationStrategyId is not yet in the type
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
      this.newStrategy = { name: '', description: '', cardIds: '' };
      this.showCreateDialog = true;
    },

    async saveNewStrategy() {
      if (!this.newStrategy.name || !this.newStrategy.cardIds) {
        // Basic validation
        alert('Strategy Name and Card IDs are required.');
        return;
      }

      this.loading = true;
      try {
        const dataLayer = getDataLayer();
        const userDB = dataLayer.getUserDB();
        const userName = userDB.getUsername();
        const courseDB = dataLayer.getCourseDB(this.courseId);

        // Process card IDs
        const cardIdArray = this.newStrategy.cardIds
          .split(/[\n,]+/)
          .map((id) => id.trim())
          .filter((id) => id);

        const strategyData: ContentNavigationStrategyData = {
          _id: `nav-strategy-hardcoded-${Date.now()}`,
          docType: DocType.NAVIGATION_STRATEGY,
          name: this.newStrategy.name,
          description: this.newStrategy.description,
          implementingClass: Navigators.HARDCODED,
          author: userName,
          course: this.courseId,
          serializedData: JSON.stringify(cardIdArray),
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
