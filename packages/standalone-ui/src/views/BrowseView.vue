<template>
  <v-container>
    <div v-if="courseId">
      <CourseInformation :course-id="courseId" :view-lookup-function="viewLookup" />
    </div>
    <div v-else class="text-center">
      <v-alert type="error">
        Course ID not found in configuration
      </v-alert>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { CourseInformation } from '@vue-skuilder/common-ui';
import config from '../../skuilder.config.json';

const courseId = ref<string>('');

// Simple fallback view lookup for standalone-ui
const viewLookup = (x: unknown) => {
  console.warn('Standalone UI view lookup not implemented for:', x);
  return null;
};

onMounted(() => {
  courseId.value = config.course || '';
});
</script>