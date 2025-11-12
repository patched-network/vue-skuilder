<template>
  <div>
    <p>{{ questionText }}</p>
    <div v-for="(option, index) in options" :key="index">
      <input type="radio" :id="`option-${index}`" :value="option" v-model="selectedAnswer" />
      <label :for="`option-${index}`">{{ option }}</label>
    </div>
    <button @click="submitAnswer">Submit</button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, PropType, defineOptions } from 'vue';
import { useViewable, useQuestionView } from '@vue-skuilder/courseware';
import { MultipleChoiceQuestion } from './MultipleChoiceQuestion';
import { ViewData } from '@vue-skuilder/common';

defineOptions({
  name: 'MultipleChoiceQuestionView'
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

const selectedAnswer = ref('');

const viewableUtils = useViewable(props, emit, 'MultipleChoiceQuestionView');
const questionUtils = useQuestionView<MultipleChoiceQuestion>(viewableUtils);

// Initialize question
questionUtils.question.value = new MultipleChoiceQuestion(props.data);

// Extract question text and options from the question instance
const questionText = computed(() => {
  const question = new MultipleChoiceQuestion(props.data);
  return (question as any)._questionText || '';
});

const options = computed(() => {
  const question = new MultipleChoiceQuestion(props.data);
  return (question as any).options || [];
});

const submitAnswer = () => {
  if (selectedAnswer.value) {
    questionUtils.submitAnswer({ response: selectedAnswer.value });
  }
};
</script>

<style scoped>
/* Add some basic styling if needed */
</style>
