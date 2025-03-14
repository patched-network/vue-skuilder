<template>
  <div data-viewable="DivisionHorizontal">
    <template v-if="question">
      {{ question.a * question.b }} &divide; {{ question.b }} =
      <UserInputNumber v-model="answer" />
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, PropType } from 'vue';
import { SingleDigitDivisionQuestion } from './index';
import { useViewable, useQuestionView } from '@vue-skuilder/common-ui';
import { ViewData } from '@/base-course/Interfaces/ViewData';
import UserInputNumber from '@/base-course/Components/UserInput/UserInputNumber.vue';

export default defineComponent({
  name: 'DivisionHorizontal',

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
    const viewableUtils = useViewable(props, emit, 'DivisionHorizontal');
    const questionUtils = useQuestionView<SingleDigitDivisionQuestion>(viewableUtils, props.modifyDifficulty);

    const answer = ref('');

    // Initialize question immediately
    questionUtils.question.value = new SingleDigitDivisionQuestion(props.data);

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
