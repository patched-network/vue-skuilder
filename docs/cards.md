# Cards

Test page works.

<script setup lang="ts">
import TestComponent from '@vue-skuilder/courseware/typing/questions/falling-letters/TestComponent.vue'
import { defineAsyncComponent } from 'vue'

const FallingLetters = defineAsyncComponent({
  loader: () => import('@vue-skuilder/courseware/typing/questions/falling-letters/FallingLettersWrapper.vue'),
  errorComponent: () => 'Failed to load FallingLetters wrapper',
  loadingComponent: () => 'Loading FallingLetters wrapper...',
})
</script>

## Test Component (Working)

<TestComponent />

## FallingLetters Component (Testing 1)

<ClientOnly>
  <FallingLetters :data="[{ gameLength: 30, initialSpeed: 1, acceleration: 0.2, spawnInterval: 1 }]" />
</ClientOnly>
