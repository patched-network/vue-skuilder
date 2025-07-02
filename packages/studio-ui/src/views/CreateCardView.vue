<template>
  <div class="create-card-view">
    <v-card>
      <v-card-title>
        <v-icon left>mdi-card-plus</v-icon>
        Create New Card
      </v-card-title>
      
      <v-card-text>
        <div v-if="loading" class="text-center pa-4">
          <v-progress-circular indeterminate />
          <p class="mt-2">Loading card creation form...</p>
        </div>

        <div v-else-if="error" class="text-center pa-4">
          <v-icon color="error" size="24">mdi-alert-circle</v-icon>
          <p class="mt-2 text-error">{{ error }}</p>
        </div>

        <div v-else-if="courseId">
          <!-- Data Input Form from edit-ui package -->
          <data-input-form 
            :course-id="courseId"
            :view-lookup-function="allCourses.getView"
            @card-created="onCardCreated"
          />
        </div>

        <div v-else>
          <p class="text-center">No course loaded</p>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { DataInputForm } from '@vue-skuilder/edit-ui';
import { allCourses } from '@vue-skuilder/courses';

// Create card state
const loading = ref(true);
const error = ref<string | null>(null);
const courseId = ref<string | null>(null);

// Initialize create card view
onMounted(async () => {
  try {
    const studioConfig = (window as any).STUDIO_CONFIG;

    if (!studioConfig?.database) {
      throw new Error('Studio database configuration not found.');
    }

    courseId.value = studioConfig.database.name;
    loading.value = false;
  } catch (err) {
    console.error('Create card initialization error:', err);
    error.value = err instanceof Error ? err.message : 'Unknown error';
    loading.value = false;
  }
});

// Handle card creation
const onCardCreated = (cardData: any) => {
  console.log('Card created:', cardData);
  // Could add success notification or redirect here
};
</script>

<style scoped>
.create-card-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
}
</style>