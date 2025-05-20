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
        @edit="editStrategy" 
        @delete="confirmDeleteStrategy"
      />

      <v-btn color="primary" class="mt-4" disabled title="New strategy types coming soon">
        <v-icon start>mdi-plus</v-icon>
        Add New Strategy
      </v-btn>



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
      strategyToDelete: null as ContentNavigationStrategyData | null
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
        
        // Get all navigation strategies
        this.strategies = await courseDB.getAllNavigationStrategies();
      } catch (error) {
        console.error('Failed to load navigation strategies:', error);
        // In case of error, use a placeholder
        this.strategies = [
          {
            id: 'ELO',
            docType: DocType.NAVIGATION_STRATEGY,
            name: 'ELO',
            description: 'Default ELO-based navigation strategy',
            implementingClass: Navigators.ELO,
            course: this.courseId,
            serializedData: '',
          },
        ];
      }
      this.loading = false;
    },

    createNewStrategy() {
      // Disabled for now - new strategy types will be implemented in the future
      console.log('Creating new strategies is not yet implemented');
    },

    editStrategy(strategy: ContentNavigationStrategyData) {
      // Strategy editing is not yet implemented
      console.log(`Editing strategy ${strategy.id} is not yet implemented`);
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
          id: this.strategyToDelete!.id,
          docType: DocType.NAVIGATION_STRATEGY,
          name: "DELETED",
          description: "This strategy has been deleted",
          implementingClass: "",
          course: this.courseId,
          serializedData: ""
        };
        
        // Update with empty strategy
        await courseDB.updateNavigationStrategy(this.strategyToDelete!.id, emptyStrategy);
        console.log(`Strategy ${this.strategyToDelete!.id} marked as deleted`);

        // Remove from our local array
        this.strategies = this.strategies.filter((s) => s.id !== this.strategyToDelete?.id);

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
