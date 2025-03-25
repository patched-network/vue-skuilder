<template>
  <div data-viewable="VerbalAddition" class="text-h5">
    <div class="text-h5">
      Count by <strong>{{ question?.n }}</strong
      >s:
    </div>

    <input type="text" disabled class="correct" :value="question?.answer[0] - question?.n" />,

    <span v-for="(a, i) in question?.answer" :key="i">
      <input
        :id="`input${i}`"
        :ref="`input${i}`"
        :class="`input${a}${i}`"
        v-model="answer[i]"
        type="text"
        :autofocus="i === 0"
        @keyup="track(i)"
      />
      <span v-if="i !== question?.answer.length - 1">, </span>
    </span>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, PropType, onMounted } from 'vue';
import { CountBy } from './index';
import { useViewable, useQuestionView } from '@vue-skuilder/common-ui';
import { ViewData } from '@vue-skuilder/common';

export default defineComponent({
  name: 'VerbalAddition',

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
    const viewableUtils = useViewable(props, emit, 'VerbalAddition');
    const questionUtils = useQuestionView<CountBy>(viewableUtils);

    const answer = ref<string[]>(['', '', '', '', '']);

    // Initialize question immediately
    questionUtils.question.value = new CountBy(props.data);

    // Expose the question directly for template access
    const question = computed(() => questionUtils.question.value);

    const track = (n: number): void => {
      console.log(`change in ${n}!
      userAnswer: ${answer.value.toString()}\n
      qAnswer:    ${question.value?.answer.toString()}`);

      if (question.value && question.value.answer[n].toString().length === answer.value[n].length) {
        if (parseInt(answer.value[n]) === question.value.answer[n]) {
          document.getElementById('input' + n)?.classList.add('correct');
          document.getElementById('input' + n)?.classList.remove('incorrect');
          document.getElementById('input' + n)?.setAttribute('disabled', 'true');

          if (n + 1 < answer.value.length) {
            document.getElementById('input' + (n + 1))?.focus();
          } else {
            questionUtils.submitAnswer(answer.value);
          }
        } else {
          document.getElementById('input' + n)?.classList.add('incorrect');
          questionUtils.submitAnswer(answer.value);
          console.log(`Wrong! ${answer.value[n]} !== ${question.value.answer[n]}`);
        }
      }
    };

    onMounted(() => {
      console.log('focusing...');
      document.getElementById('input0')?.focus();
    });

    return {
      ...viewableUtils,
      ...questionUtils,
      answer,
      question,
      track,
    };
  },
});
</script>

<style scoped>
input {
  width: 3em;
  /* border: black; */
  border-style: solid;
  border-bottom-color: black;
  border-width: 1px;
  text-align: center;
  /* background-color: red; */
}

.incorrect {
  box-shadow: 0px 0px 5px 0px rgb(180, 0, 95);
}
.correct {
  box-shadow: 0px 0px 5px 0px green;
}
</style>
