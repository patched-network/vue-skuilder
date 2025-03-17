<template>
  <div data-viewable="IdentifyVocab">
    <template v-if="question"> This is a vocabulary question. </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, PropType } from 'vue';
import { useViewable, useQuestionView } from '@vue-skuilder/common-ui';
import { VocabQuestion } from '@/courses/french/questions/vocab';
import { ViewData } from '@vue-skuilder/common';
// import AudioAutoPlayer from '@/base-course/Components/AudioAutoPlayer.vue';
// import UserInputString from '@/base-course/Components/UserInput/UserInputString.vue';

export default defineComponent({
  name: 'IdentifyVocab',

  components: {
    // AudioAutoPlayer,
    // UserInputString,
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
    const viewableUtils = useViewable(props, emit, 'IdentifyVocab');
    const questionUtils = useQuestionView<VocabQuestion>(viewableUtils);

    // Initialize question immediately
    questionUtils.question.value = new VocabQuestion(props.data);

    // Expose the question directly for template access
    const question = computed(() => questionUtils.question.value);

    return {
      ...viewableUtils,
      ...questionUtils,
      question,
    };
  },
});
</script>
