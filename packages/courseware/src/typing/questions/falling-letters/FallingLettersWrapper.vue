<template>
  <div style="border: 2px solid green; padding: 20px; margin: 10px; background: #f0fff0">
    <h3>FallingLetters Wrapper</h3>
    <p>This is a minimal wrapper to test import chain issues.</p>
    <p>Props received: {{ JSON.stringify($props) }}</p>

    <!-- Try to load the real component with error boundary -->
    <Suspense>
      <template #default>
        <FallingLettersReal v-bind="$props" />
      </template>
      <template #fallback>
        <div>Loading real FallingLetters component...</div>
      </template>
    </Suspense>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import type { ViewData } from '@vue-skuilder/common';

// Props
defineProps<{
  data: ViewData[];
}>();

// Try to load the real component with explicit error handling
const FallingLettersReal = defineAsyncComponent({
  loader: async () => {
    try {
      console.log('Attempting to load FallingLetters.vue directly...');
      // Import directly, bypassing any circular dependency through index.ts
      const { default: component } = await import('./FallingLetters.vue');
      console.log('Successfully loaded FallingLetters.vue:', component);
      return component;
    } catch (error) {
      console.error('Detailed error loading FallingLetters.vue:', error);
      throw error;
    }
  },
  onError: (error) => {
    console.error('AsyncComponent onError:', error);
  },
  timeout: 5000,
  errorComponent: {
    template: '<div style="color: red; padding: 10px;">Error loading FallingLetters: {{ error }}</div>',
    props: ['error'],
  },
});
</script>
