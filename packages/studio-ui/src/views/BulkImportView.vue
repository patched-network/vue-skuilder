<template>
  <div class="bulk-import-view">
    <v-card>
      <v-card-title>
        <v-icon start>mdi-file-import</v-icon>
        Bulk Import Cards
      </v-card-title>

      <v-card-text>
        <div v-if="loading" class="text-center pa-4">
          <v-progress-circular indeterminate />
          <p class="mt-2">Loading bulk import tool...</p>
        </div>

        <div v-else-if="error" class="text-center pa-4">
          <v-icon color="error" size="24">mdi-alert-circle</v-icon>
          <p class="mt-2 text-error">{{ error }}</p>
        </div>

        <div v-else-if="courseId && courseConfig">
          <!-- Bulk Import View from edit-ui package -->
          <bulk-import-view
            :course-cfg="courseConfig"
            :view-lookup-function="allCourses.getView"
            @import-completed="onImportCompleted"
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
import { BulkImportView } from '@vue-skuilder/edit-ui';
import { allCourses } from '@vue-skuilder/courseware';
import { getStudioConfig, getConfigErrorMessage } from '../config/development';
import { getDataLayer } from '@vue-skuilder/db';
import type { CourseConfig } from '@vue-skuilder/common';

// Bulk import state
const loading = ref(true);
const error = ref<string | null>(null);
const courseId = ref<string | null>(null);
const courseConfig = ref<CourseConfig | null>(null);

// Initialize bulk import view
onMounted(async () => {
  try {
    // Get studio configuration (CLI-injected or environment variables)
    const studioConfig = getStudioConfig();

    if (!studioConfig) {
      throw new Error(getConfigErrorMessage());
    }

    courseId.value = studioConfig.database.name;

    // Load course configuration
    const dataLayer = getDataLayer();
    const courseDB = dataLayer.getCourseDB(courseId.value);
    courseConfig.value = await courseDB.getCourseConfig();

    loading.value = false;
  } catch (err) {
    console.error('Bulk import initialization error:', err);
    error.value = err instanceof Error ? err.message : 'Unknown error';
    loading.value = false;
  }
});

// Handle import completion
const onImportCompleted = (result: unknown) => {
  console.log('Import completed:', result);
  // Could add success notification here
};
</script>

<style scoped>
.bulk-import-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
}
</style>
