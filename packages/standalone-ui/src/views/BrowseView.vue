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
import { allCourses } from '@vue-skuilder/courses';
import config from '../../skuilder.config.json';

const courseId = ref<string>('');

// Full view lookup using courses package (same as platform-ui)
const viewLookup = (x: unknown) => {
  return allCourses.getView(x);
};

onMounted(() => {
  courseId.value = config.course || '';
});
</script>