<template>
  <div>
    <p>HELLO WORLD</p>
    <p>{{ questionText }}</p>
    <input v-model="userAnswer" @keyup.enter="submitAnswer" placeholder="Your answer" />
    <button @click="submitAnswer">Submit</button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, PropType, defineOptions } from 'vue';
import { useViewable, useQuestionView } from '@vue-skuilder/courseware';
import { SimpleTextQuestion } from './SimpleTextQuestion';
import { ViewData } from '@vue-skuilder/common';

defineOptions({
  name: 'SimpleTextQuestionView',
});

const props = defineProps({
  data: {
    type: Array as PropType<ViewData[]>,
    required: true,
  },
  modifyDifficulty: {
    type: Number,
    required: false,
    default: 0,
  },
});

const emit = defineEmits(['emit-response']);

const userAnswer = ref('');

const viewableUtils = useViewable(props, emit, 'SimpleTextQuestionView');
const questionUtils = useQuestionView<SimpleTextQuestion>(viewableUtils);

// Initialize question
questionUtils.question.value = new SimpleTextQuestion(props.data);

// Extract question text from the question instance
const questionText = computed(() => {
  const question = new SimpleTextQuestion(props.data);
  return (question as any).questionText || '';
});

const submitAnswer = () => {
  questionUtils.submitAnswer({ response: userAnswer.value });
};
</script>

<style scoped>
/* Add some basic styling if needed */
</style>
