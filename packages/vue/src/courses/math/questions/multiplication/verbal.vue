<template>
  <div data-viewable="VerbalMultiplication">
    <template v-if="question">
      {{ question.a }} times {{ question.b }} is
      <UserInputNumber v-model="answer" />
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, PropType } from 'vue';
import { SingleDigitMultiplicationQuestion } from './index';
import { useViewable, useQuestionView } from '@/base-course/CompositionViewable';
import { ViewData } from '@/base-course/Interfaces/ViewData';
import UserInputNumber from '@/base-course/Components/UserInput/UserInputNumber.vue';

export default defineComponent({
  name: 'VerbalMultiplication',

  components: {
    UserInputNumber,
  },

  props: {
    data: {
      type: Array as PropType<ViewData[]>,
      required: true,
    },
    modifyDifficulty: {
      type: Number,
      required: false,
      default: 0,
    },
  },

  setup(props, { emit }) {
    const viewableUtils = useViewable(props, emit, 'VerbalMultiplication');
    const questionUtils = useQuestionView<SingleDigitMultiplicationQuestion>(viewableUtils, props.modifyDifficulty);

    const answer = ref('');

    // Initialize question immediately
    questionUtils.question.value = new SingleDigitMultiplicationQuestion(props.data);

    // Expose the question directly for template access
    const question = computed(() => questionUtils.question.value);

    const submit = () => {
      if (question.value) {
        const isCorrect = question.value.isCorrect(parseInt(answer.value, 10));
        alert(isCorrect);
      }
    };

    return {
      ...viewableUtils,
      ...questionUtils,
      answer,
      question,
      submit,
    };
  },
});
</script>
