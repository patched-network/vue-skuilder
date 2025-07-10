<template>
  <div>
    <p>{{ questionText }}</p>
    <div v-for="(option, index) in options" :key="index">
      <input
        type="radio"
        :id="`option-${index}`"
        :value="option"
        v-model="selectedAnswer"
      />
      <label :for="`option-${index}`">{{ option }}</label>
    </div>
    <button @click="submitAnswer">Submit</button>
  </div>
</template>

<script setup lang="ts">
import { ref, PropType } from 'vue';
import { useViewable, useQuestionView } from '@vue-skuilder/common-ui';
import { MultipleChoiceQuestion } from './MultipleChoiceQuestion';
import { ViewData } from '@vue-skuilder/common';

const props = defineProps({
  questionText: {
    type: String,
    required: true,
  },
  options: {
    type: Array as () => string[],
    required: true,
  },
  data: {
    type: Array as PropType<ViewData[]>,
    required: true,
  },
});

const selectedAnswer = ref('');

const viewableUtils = useViewable(props, () => {}, 'MultipleChoiceQuestionView');
const questionUtils = useQuestionView<MultipleChoiceQuestion>(viewableUtils);

// Initialize question
questionUtils.question.value = new MultipleChoiceQuestion(props.data);

const submitAnswer = () => {
  if (selectedAnswer.value) {
    questionUtils.submitAnswer({ response: selectedAnswer.value });
  }
};
</script>

<style scoped>
/* Add some basic styling if needed */
</style>