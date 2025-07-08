<template>
  <v-container>
    <h1>User Stats</h1>
    
    <div v-if="loading">Loading...</div>
    
    <div v-else-if="userElo">
      <h2>ELO Profile</h2>
      
      <h3>Global ELO</h3>
      <p>Score: {{ userElo.global.score }}</p>
      <p>Interactions: {{ userElo.global.count }}</p>
      
      <h3 v-if="Object.keys(userElo.tags).length > 0">Tag-Specific ELOs</h3>
      <ul v-if="Object.keys(userElo.tags).length > 0">
        <li v-for="(elo, tag) in userElo.tags" :key="tag">
          {{ tag }}: {{ elo.score }} ({{ elo.count }} interactions)
        </li>
      </ul>
      
      <h3 v-if="Object.keys(userElo.misc).length > 0">Additional Metrics</h3>
      <ul v-if="Object.keys(userElo.misc).length > 0">
        <li v-for="(value, key) in userElo.misc" :key="key">
          {{ key }}: {{ value }}
        </li>
      </ul>
    </div>
    
    <p v-else>No ELO data found.</p>
    
    <p><a href="#" @click="$router.back()">Back</a></p>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getDataLayer } from '@vue-skuilder/db';
import { getCurrentUser } from '@vue-skuilder/common-ui';
import { CourseElo } from '@vue-skuilder/common';
import config from '../../skuilder.config.json';

const loading = ref(true);
const userElo = ref<CourseElo | null>(null);

// Simple MVP - no color coding needed

onMounted(async () => {
  try {
    const courseId = config.course;
    if (!courseId) {
      console.error('No course ID found in config');
      return;
    }

    const user = await getCurrentUser();
    const dataLayer = getDataLayer();
    const courseDB = dataLayer.getCourseDB(courseId);
    
    // Try to get user's ELO profile for this course
    const userRegistrations = await dataLayer.getUserDB(user.getUsername()).getCourseRegistrations();
    const courseReg = userRegistrations.find(reg => reg.courseID === courseId);
    
    if (courseReg && courseReg.elo) {
      userElo.value = courseReg.elo;
    } else {
      // No ELO data yet
      userElo.value = null;
    }
  } catch (error) {
    console.error('Error loading user ELO:', error);
    userElo.value = null;
  } finally {
    loading.value = false;
  }
});
</script>