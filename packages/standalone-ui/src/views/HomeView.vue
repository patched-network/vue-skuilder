<template>
  <v-container>
    <v-row>
      <v-col cols="12" class="text-center">
        <h1 class="text-h3 mb-6">{{ courseConfig.title }}</h1>
        <p class="text-body-1 mb-6">{{ courseConfig.description }}</p>
        <v-btn color="primary" size="large" to="/study"> Start Learning </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { useCourseConfig } from '../composables/useCourseConfig';

const { courseConfig } = useCourseConfig();
</script>
