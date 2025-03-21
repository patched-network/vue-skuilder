<template>
  <div data-viewable="IdentifyKeyView">
    <template v-if="question">
      <MusicScoreRenderer :key-signature="`X:1\nK:${question.key}\n||`" />
      This signature is for the major key: _____
      <RadioSelect :choice-list="choices" />
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, PropType } from 'vue';
import RadioSelect from '@/base-course/Components/RadioMultipleChoice.vue';
import MusicScoreRenderer from '@/courses/components/MusicScoreRender.vue';
import { useViewable, useQuestionView } from '@/base-course/CompositionViewable';
import { ViewData } from '@/base-course/Interfaces/ViewData';
import { IdentifyKeyQuestion, keys } from './index';

function fiveRandomKeys() {
  const randomKeys = [];
  for (let i = 0; i < 5; i++) {
    randomKeys.push(keys[Math.floor(Math.random() * keys.length)]);
  }
  return randomKeys;
}

export default defineComponent({
  name: 'IdentifyKeyView',

  components: {
    RadioSelect,
    MusicScoreRenderer,
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
    const viewableUtils = useViewable(props, emit, 'IdentifyKeyView');
    const questionUtils = useQuestionView<IdentifyKeyQuestion>(viewableUtils, props.modifyDifficulty);

    const answer = ref('');

    // Initialize question immediately
    questionUtils.question.value = new IdentifyKeyQuestion(props.data);

    // Expose the question directly for template access
    const question = computed(() => questionUtils.question.value);

    const choices = computed(() => {
      const ch = fiveRandomKeys();
      if (ch.includes(question.value?.key || '')) {
        return ch;
      } else {
        ch[Math.floor(Math.random() * ch.length)] = question.value?.key || '';
        return ch;
      }
    });

    const submit = () => {};

    return {
      ...viewableUtils,
      ...questionUtils,
      answer,
      question,
      choices,
      submit,
    };
  },
});
</script>
