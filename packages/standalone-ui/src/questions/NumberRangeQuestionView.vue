<template>
  <div>
    <p>{{ questionText }}</p>
    <input type="number" v-model.number="userAnswer" @keyup.enter="submitAnswer" placeholder="Enter a number" />
    <button @click="submitAnswer">Submit</button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, PropType, defineOptions } from 'vue';
import { useViewable, useQuestionView } from '@vue-skuilder/courseware';
import { NumberRangeQuestion } from './NumberRangeQuestion';
import { ViewData } from '@vue-skuilder/common';

defineOptions({
  name: 'NumberRangeQuestionView'
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

const userAnswer = ref<number | null>(null);

const viewableUtils = useViewable(props, emit, 'NumberRangeQuestionView');
const questionUtils = useQuestionView<NumberRangeQuestion>(viewableUtils);

// Initialize question
questionUtils.question.value = new NumberRangeQuestion(props.data);

// Extract question text from the question instance
const questionText = computed(() => {
  const question = new NumberRangeQuestion(props.data);
  return (question as any).questionText || '';
});

const submitAnswer = () => {
  if (userAnswer.value !== null) {
    questionUtils.submitAnswer({ response: userAnswer.value });
  }
};
</script>

<style scoped>
/* Add some basic styling if needed */
</style>
