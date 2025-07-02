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

        <div v-else-if="courseId && courseConfig">
          <!-- Card type selector -->
          <v-select
            v-if="availableDataShapes.length > 1"
            v-model="selectedDataShapeIndex"
            :items="
              availableDataShapes.map((shape, index) => ({
                title: shape.name.replace(/^.*\./, ''),
                value: index,
              }))
            "
            label="Card Type"
            class="mb-4"
          />

          <!-- Data Input Form from edit-ui package -->
          <data-input-form
            v-if="selectedDataShape"
            :course-id="courseId"
            :course-cfg="courseConfig"
            :data-shape="selectedDataShape"
            :view-lookup-function="allCourses.getView"
            @card-created="onCardCreated"
          />

          <div v-else-if="availableDataShapes.length === 0" class="text-center pa-4">
            <v-icon color="warning" size="24">mdi-alert</v-icon>
            <p class="mt-2">No card types available in this course</p>
          </div>
        </div>

        <div v-else>
          <p class="text-center">No course loaded</p>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { DataInputForm } from '@vue-skuilder/edit-ui';
import { allCourses } from '@vue-skuilder/courses';
import { getStudioConfig, getConfigErrorMessage } from '../config/development';
import { getDataLayer } from '@vue-skuilder/db';
import type { CourseConfig, DataShape } from '@vue-skuilder/common';

// Create card state
const loading = ref(true);
const error = ref<string | null>(null);
const courseId = ref<string | null>(null);
const courseConfig = ref<CourseConfig | null>(null);
const selectedDataShapeIndex = ref<number>(0);

// Get available data shapes
const availableDataShapes = computed(() => {
  if (!courseConfig.value?.dataShapes) return [];
  return courseConfig.value.dataShapes;
});

// Get currently selected data shape
const selectedDataShape = computed((): DataShape | null => {
  const shapes = availableDataShapes.value;
  if (shapes.length === 0) return null;

  // Find the corresponding DataShape from allCourses
  const shapeName = shapes[selectedDataShapeIndex.value]?.name;
  if (!shapeName) return null;

  // Search through all courses to find the DataShape
  for (const course of allCourses.courses) {
    for (const question of course.questions) {
      for (const dataShape of question.dataShapes) {
        if (dataShape.name === shapeName.split('.').pop()) {
          return dataShape;
        }
      }
    }
  }
  return null;
});

// Initialize create card view
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
