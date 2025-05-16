<template>
  <div class="navigation-strategy-editor">
    <div v-if="loading">
      <v-progress-circular indeterminate color="secondary"></v-progress-circular>
    </div>
    <div v-else>
      <h2 class="text-h5 mb-4">Navigation Strategies</h2>

      <div v-if="strategies.length === 0" class="no-strategies">
        <p>No navigation strategies defined for this course. Course will be served via default ELO based strategy.</p>
      </div>

      <navigation-strategy-list
        v-else
        :strategies="strategies"
        :active-strategy-id="activeStrategyId"
        @edit="editStrategy"
        @activate="activateStrategy"
        @delete="confirmDeleteStrategy"
      />

      <v-btn color="primary" class="mt-4" @click="createNewStrategy">
        <v-icon start>mdi-plus</v-icon>
        Add New Strategy
      </v-btn>

      <v-dialog v-model="showForm" max-width="700px">
        <v-card>
          <v-card-title class="text-h5">
            {{ isEditing ? 'Edit Navigation Strategy' : 'Create Navigation Strategy' }}
          </v-card-title>
          <v-card-text>
            <navigation-strategy-form
              :strategy="currentStrategy"
              :course-id="courseId"
              @save="saveStrategy"
              @cancel="cancelEdit"
            />
          </v-card-text>
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
import NavigationStrategyForm from './NavigationStrategyForm.vue';
import { getDataLayer, DocType, Navigators } from '@vue-skuilder/db';

export default defineComponent({
  name: 'NavigationStrategyEditor',

  components: {
    NavigationStrategyList,
    NavigationStrategyForm,
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
      currentStrategy: null as ContentNavigationStrategyData | null,
      showForm: false,
      isEditing: false,
      loading: true,
      activeStrategyId: '',
      showDeleteConfirm: false,
      strategyToDelete: null as ContentNavigationStrategyData | null,
    };
  },

  async created() {
    await this.loadStrategies();
  },

  methods: {
    async loadStrategies() {
      this.loading = true;
      try {
        const courseDB = getDataLayer().getCoursesDB(this.courseId);

        // Get all navigation strategies
        this.strategies = await courseDB.getAllNavigationStrategies();

        // Get the active strategy
        const activeStrategy = await courseDB.surfaceNavigationStrategy();
        this.activeStrategyId = activeStrategy.id;
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
        this.activeStrategyId = 'ELO';
      }
      this.loading = false;
    },

    createNewStrategy() {
      this.currentStrategy = {
        id: '', // Will be generated when saved
        docType: DocType.NAVIGATION_STRATEGY,
        name: '',
        description: '',
        implementingClass: Navigators.ELO, // Default to ELO
        course: this.courseId,
        serializedData: '',
      };
      this.isEditing = false;
      this.showForm = true;
    },

    editStrategy(strategy: ContentNavigationStrategyData) {
      this.currentStrategy = { ...strategy };
      this.isEditing = true;
      this.showForm = true;
    },

    async saveStrategy(strategy: ContentNavigationStrategyData) {
      this.loading = true;
      try {
        const courseDB = getDataLayer().getCoursesDB(this.courseId);

        if (this.isEditing) {
          // Update existing strategy
          await courseDB.updateNavigationStrategy(strategy.id, strategy);
        } else {
          // For new strategies, generate an ID if not provided
          if (!strategy.id) {
            strategy.id = `strategy-${Date.now()}`;
          }
          // Add new strategy
          await courseDB.addNavigationStrategy(strategy);
        }

        // Reload strategies to get the updated list
        await this.loadStrategies();
        this.showForm = false;
      } catch (error) {
        console.error('Failed to save navigation strategy:', error);
        // In a real app, you would show an error message to the user
      }
      this.loading = false;
    },

    cancelEdit() {
      this.showForm = false;
      this.currentStrategy = null;
    },

    async activateStrategy(strategyId: string) {
      // Set the active strategy ID locally
      this.activeStrategyId = strategyId;

      // In a real implementation, you would save this preference to the database
      // For now, we just log it
      console.log(`Strategy ${strategyId} activated`);

      // In the future, you might implement:
      // await courseDB.setActiveNavigationStrategy(strategyId);
    },

    confirmDeleteStrategy(strategy: ContentNavigationStrategyData) {
      this.strategyToDelete = strategy;
      this.showDeleteConfirm = true;
    },

    async deleteStrategy() {
      if (!this.strategyToDelete) return;

      this.loading = true;
      try {
        // In a real implementation, you would call an API to delete the strategy
        console.log(`Strategy ${this.strategyToDelete.id} deleted`);

        // For now, we only support removal from the local array
        // In the future, you would implement:
        // await courseDB.deleteNavigationStrategy(this.strategyToDelete.id);

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
