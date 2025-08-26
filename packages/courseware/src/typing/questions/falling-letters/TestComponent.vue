<template>
  <div style="border: 2px solid red; padding: 20px; margin: 10px; background: #f9f9f9;">
    <h2>Test Component from Monorepo</h2>
    <p>This is a simple Vue component with no external dependencies.</p>
    <button @click="count++" style="padding: 8px 16px; margin: 5px;">
      Clicked {{ count }} times
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const count = ref(0)
</script>