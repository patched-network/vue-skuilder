<template>
  <v-app :theme="theme">
    <course-header :title="courseConfig.title" :logo="courseConfig.logo" />

    <v-main>
      <router-view />
    </v-main>

    <course-footer :links="courseConfig.links" :copyright="courseConfig.copyright" />
  </v-app>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCourseConfig } from './composables/useCourseConfig';
import CourseHeader from './components/CourseHeader.vue';
import CourseFooter from './components/CourseFooter.vue';

const { courseConfig } = useCourseConfig();
const theme = computed(() => (courseConfig.darkMode ? 'dark' : 'light'));
</script>
