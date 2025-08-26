<template>
  <div style="border: 2px solid red; padding: 20px; margin: 10px; background: #f9f9f9">
    <h2>Test Component from Monorepo</h2>
    <p>Testing TypeScript imports with lang="ts"</p>
    <button @click="count++" style="padding: 8px 16px; margin: 5px">Clicked {{ count }} times</button>

    <div style="margin-top: 10px; font-size: 12px">
      <strong>Imported types evidence:</strong><br />
      testLetter: {{ testLetter }}<br />
      testPos: {{ testPos }}<br />
      testViewData: {{ testViewData }}<br />
      viewable exists: {{ !!viewable }}<br />
      questionView exists: {{ !!questionView }}<br />
      FallingLettersQuestion class: {{ questionClass?.name }}<br />
      FallingLettersQuestion dataShapes: {{ questionClass?.dataShapes?.length }} items
    </div>
  </div>
</template>

<script setup lang="ts">
// FallingLetters.vue imports to test incrementally:

// Current working imports:
import { defineComponent, ref, onMounted, onUnmounted, PropType } from 'vue';
import { Letter, TreePosition } from './types';
import { ViewData } from '@vue-skuilder/common';
import { useViewable, useQuestionView } from '@vue-skuilder/common-ui';
import { FallingLettersQuestion } from './index';

const count = ref(0);
const testLetter = { id: 1, char: 'A', x: 10, y: 20 } as Letter;
const testPos = { id: 1, left: 0, height: 100, scale: 1 } as TreePosition;
const testViewData = { testField: 'hello' } as ViewData;

// Test common-ui composables
const viewable = useViewable();
const questionView = useQuestionView();

// Test FallingLettersQuestion class
const questionClass = FallingLettersQuestion;
</script>
