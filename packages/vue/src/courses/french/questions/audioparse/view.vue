<template>
  <div data-viewable="AudioParseView">
    <template v-if="question">
      <AudioAutoPlayer :src="getURL('audio')" />
      <br /><br />
      {{ question.text }}
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, PropType } from 'vue';
import { AudioParsingQuestion } from './index';
import { useViewable, useQuestionView } from '@/base-course/CompositionViewable';
import { ViewData } from '@/base-course/Interfaces/ViewData';
import AudioAutoPlayer from '@/base-course/Components/AudioAutoPlayer.vue';

export default defineComponent({
  name: 'AudioParseView',

  components: {
    AudioAutoPlayer,
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
    const viewableUtils = useViewable(props, emit, 'AudioParseView');
    const questionUtils = useQuestionView<AudioParsingQuestion>(viewableUtils, props.modifyDifficulty);

    const answer = ref('');

    // Initialize question immediately
    questionUtils.question.value = new AudioParsingQuestion(props.data);

    // Expose the question directly for template access
    const question = computed(() => questionUtils.question.value);

    const submit = () => {
      if (question.value) {
        // const isCorrect = question.value.isCorrect(parseInt(answer.value, 10));
        // alert(isCorrect);
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
