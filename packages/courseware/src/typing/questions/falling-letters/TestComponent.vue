<template>
  <div style="border: 2px solid red; padding: 20px; margin: 10px; background: #f9f9f9">
    <h2>Test Component from Monorepo</h2>
    <p>Testing TypeScript imports with lang="ts"</p>
    <button @click="count++" style="padding: 8px 16px; margin: 5px">Clicked {{ count }} times</button>
    
    <div style="margin-top: 10px; font-size: 12px;">
      <strong>Imported types evidence:</strong><br>
      testLetter: {{ testLetter }}<br>
      testPos: {{ testPos }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Letter, TreePosition } from './types';

const count = ref(0);
const testLetter = { id: 1, char: 'A', x: 10, y: 20 } as Letter;
const testPos = { id: 1, left: 0, height: 100, scale: 1 } as TreePosition;
</script>
