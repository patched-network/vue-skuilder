<template>
  <div>
    <p>{{ questionText }}</p>
    <input v-model="userAnswer" @keyup.enter="submitAnswer" placeholder="Your answer" />
    <button @click="submitAnswer">Submit</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, PropType } from 'vue';
import { useViewable, useQuestionView } from '@vue-skuilder/courseware';
import { SimpleTextQuestion } from './SimpleTextQuestion';
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

const userAnswer = ref('');

const viewableUtils = useViewable(props, () => {}, 'SimpleTextQuestionView');
const questionUtils = useQuestionView<SimpleTextQuestion>(viewableUtils);

// Initialize question
questionUtils.question.value = new SimpleTextQuestion(props.data);

const submitAnswer = () => {
  questionUtils.submitAnswer({ response: userAnswer.value });
};

onMounted(() => {
  // Optionally, you might want to focus the input field on mount
  // This requires a ref on the input element
});
</script>

<style scoped>
/* Add some basic styling if needed */
</style>
