<template>
  <div data-viewable="AdditionHorizontal">
    <template v-if="question">
      {{ question.a }} + {{ question.b }} =
      <UserInputNumber v-model="answer" />
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, PropType } from 'vue';
import { SingleDigitAdditionQuestion } from './index';
import { UserInputNumber, useViewable, useQuestionView } from '@vue-skuilder/common-ui';
import { ViewData } from '@vue-skuilder/common';

export default defineComponent({
  name: 'AdditionHorizontal',

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
    const viewableUtils = useViewable(props, emit, 'AdditionHorizontal');
    const questionUtils = useQuestionView<SingleDigitAdditionQuestion>(viewableUtils, props.modifyDifficulty);

    const answer = ref('');

    // Initialize question immediately
    questionUtils.question.value = new SingleDigitAdditionQuestion(props.data);

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
      question, // expose the computed question directly
      submit,
    };
  },
});
</script>
