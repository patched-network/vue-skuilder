<template>
  <div>
    <p>{{ questionText }}</p>
    <input type="number" v-model.number="userAnswer" @keyup.enter="submitAnswer" placeholder="Enter a number" />
    <button @click="submitAnswer">Submit</button>
  </div>
</template>

<script setup lang="ts">
import { ref, PropType } from 'vue';
import { useViewable, useQuestionView } from '@vue-skuilder/common-ui';
import { NumberRangeQuestion } from './NumberRangeQuestion';
import { ViewData } from '@vue-skuilder/common';

const props = defineProps({
  questionText: {
    type: String,
    required: true,
  },
  data: {
    type: Array as PropType<ViewData[]>,
    required: true,
  },
});

const userAnswer = ref<number | null>(null);

const viewableUtils = useViewable(props, () => {}, 'NumberRangeQuestionView');
const questionUtils = useQuestionView<NumberRangeQuestion>(viewableUtils);

// Initialize question
questionUtils.question.value = new NumberRangeQuestion(props.data);

const submitAnswer = () => {
  if (userAnswer.value !== null) {
    questionUtils.submitAnswer({ response: userAnswer.value });
  }
};
</script>

<style scoped>
/* Add some basic styling if needed */
</style>