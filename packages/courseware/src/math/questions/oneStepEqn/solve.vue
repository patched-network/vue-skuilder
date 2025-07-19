<template>
  <div data-viewable="Solve">
    <template v-if="question">
      <h4>Solve the Equation</h4>
      <br /><br />
      <div v-if="question.operation.valueOf() === 'ADDITION'">{{ variable }} - {{ question.a }} = {{ question.b }}</div>
      <div v-else-if="question.operation.valueOf() === 'SUBTRACTION'">
        {{ variable }} + {{ question.a }} = {{ question.b }}
      </div>
      <div v-else-if="question.operation.valueOf() === 'MULTIPLICATION'">
        {{ variable }} &#247; {{ question.a }} = {{ question.b }}
      </div>
      <div v-else-if="question.operation.valueOf() === 'DIVISION'">
        {{ variable }} * {{ question.a }} = {{ question.b * question.a }}
      </div>
      <div v-else>No operation!? (This should never show)</div>

      <br /><br />

      {{ variable }} = <UserInputNumber v-model="answer" />
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, PropType } from 'vue';
import { OneStepEquation } from './index';
import { UserInputNumber, useViewable, useQuestionView } from '@vue-skuilder/common-ui';
import { ViewData } from '@vue-skuilder/common';
import { randomInt } from '../../utility';

export default defineComponent({
  name: 'SolveView',

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
    const viewableUtils = useViewable(props, emit, 'Solve');
    const questionUtils = useQuestionView<OneStepEquation>(viewableUtils);

    const answer = ref('');
    const vars = ['a', 'b', 'd', 'A', 'z', 'B', 'd', 'y'];
    const variable = ref(vars[randomInt(0, vars.length)]);

    // Initialize question immediately
    questionUtils.question.value = new OneStepEquation(props.data);

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
      variable,
      submit,
    };
  },
});
</script>
