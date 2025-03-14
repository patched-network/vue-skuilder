<template>
  <div data-viewable="IdentifyChroma">
    <template v-if="question">
      What note is being played?
      <radio-multiple-choice :choice-list="question.choiceList" />
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, PropType } from 'vue';
import { ChromaQuestion } from './index';
import { useViewable, useQuestionView } from '@vue-skuilder/common-ui';
import { ViewData } from '@/base-course/Interfaces/ViewData';
import RadioMultipleChoice from '@/base-course/Components/RadioMultipleChoice.vue';

export default defineComponent({
  name: 'IdentifyChroma',

  components: {
    RadioMultipleChoice,
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
    const viewableUtils = useViewable(props, emit, 'IdentifyChroma');
    const questionUtils = useQuestionView<ChromaQuestion>(viewableUtils, props.modifyDifficulty);

    const answer = ref('');
    const ctx = ref(new AudioContext());

    // Initialize question immediately
    questionUtils.question.value = new ChromaQuestion(props.data);

    // Expose the question directly for template access
    const question = computed(() => questionUtils.question.value);

    const octaves = (freq: number): number[] => {
      const ret: number[] = [];
      let lowerFreq: number = freq / 2;
      while (lowerFreq > 100) {
        ret.push(lowerFreq);
        lowerFreq /= 2;
      }
      ret.push(freq);
      let above: number = freq * 2;
      while (above < 5000) {
        ret.push(above);
        above *= 2;
      }
      return ret;
    };

    const tone = (freq: number) => {
      const osc = ctx.value.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const g = ctx.value.createGain();
      console.log('Max Gain: ' + g.gain.maxValue);
      g.gain.setValueAtTime(0, 0);
      g.gain.linearRampToValueAtTime(0.5, 15);

      osc.connect(g);
      g.connect(ctx.value.destination);

      osc.start(0);
      osc.stop(14);
    };

    onMounted(() => {
      octaves(295).forEach((t) => tone(t));
    });

    const submit = () => {
      if (question.value) {
        question.value.isCorrect(answer.value);
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
