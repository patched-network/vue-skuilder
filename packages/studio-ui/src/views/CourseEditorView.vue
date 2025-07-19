<template>
  <div class="course-editor-view">
    <div v-if="loading" class="text-center pa-4">
      <v-progress-circular indeterminate />
      <p class="mt-2">Loading course editor...</p>
    </div>

    <div v-else-if="error" class="text-center pa-4">
      <v-icon color="error" size="48">mdi-alert-circle</v-icon>
      <h2 class="mt-2">Editor Error</h2>
      <p>{{ error }}</p>
    </div>

    <div v-else-if="courseId">
      <!-- Course Editor from edit-ui package -->
      <course-editor :course="courseId" :view-lookup-function="allCourseWare.getView" />
    </div>

    <div v-else class="text-center pa-4">
      <v-icon size="48">mdi-school</v-icon>
      <h2 class="mt-2">No Course Loaded</h2>
      <p>Please load a course to start editing.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { CourseEditor } from '@vue-skuilder/edit-ui';
import { allCourseWare } from '@vue-skuilder/courseware';
import { getStudioConfig, getConfigErrorMessage } from '../config/development';

// Course editor state
const loading = ref(true);
const error = ref<string | null>(null);
const courseId = ref<string | null>(null);

// Initialize course editor
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
    console.error('Course editor initialization error:', err);
    error.value = err instanceof Error ? err.message : 'Unknown error';
    loading.value = false;
  }
});
</script>

<style scoped>
.course-editor-view {
  height: 100%;
}
</style>
