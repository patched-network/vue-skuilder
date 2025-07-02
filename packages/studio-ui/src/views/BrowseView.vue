<template>
  <div class="browse-view">
    <div v-if="loading" class="text-center pa-4">
      <v-progress-circular indeterminate />
      <p class="mt-2">Loading course...</p>
    </div>

    <div v-else-if="error" class="text-center pa-4">
      <v-icon color="error" size="48">mdi-alert-circle</v-icon>
      <h2 class="mt-2">Browse Error</h2>
      <p>{{ error }}</p>
    </div>

    <div v-else-if="courseId">
      <course-information :course-id="courseId" :view-lookup-function="allCourses.getView" :edit-mode="'full'">
        <template #header>
          <div class="studio-header">
            <h1>Course Editor</h1>
            <p class="text-subtitle-1">
              Editing course: <strong>{{ courseId }}</strong>
            </p>
          </div>
        </template>
        <template #actions></template>
      </course-information>
    </div>

    <div v-else class="text-center pa-4">
      <v-icon size="48">mdi-school</v-icon>
      <h2 class="mt-2">No Course Loaded</h2>
      <p>Please load a course to start browsing.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { CourseInformation } from '@vue-skuilder/common-ui';
import { allCourses } from '@vue-skuilder/courses';
import { getStudioConfig, getConfigErrorMessage } from '../config/development';

// Browse view state
const loading = ref(true);
const error = ref<string | null>(null);
const courseId = ref<string | null>(null);

// Initialize browse view
onMounted(async () => {
  try {
    // Get studio configuration (CLI-injected or environment variables)
    const studioConfig = getStudioConfig();

    if (!studioConfig) {
      throw new Error(getConfigErrorMessage());
    }

    courseId.value = studioConfig.database.name;
    loading.value = false;
  } catch (err) {
    console.error('Browse view initialization error:', err);
    error.value = err instanceof Error ? err.message : 'Unknown error';
    loading.value = false;
  }
});
</script>

<style scoped>
.browse-view {
  height: 100%;
}

.studio-header {
  padding: 16px 0;
}

.studio-header h1 {
  color: rgb(var(--v-theme-primary));
  font-weight: 500;
}

.studio-header p {
  color: rgb(var(--v-theme-on-surface-variant));
  margin: 0;
}
</style>
