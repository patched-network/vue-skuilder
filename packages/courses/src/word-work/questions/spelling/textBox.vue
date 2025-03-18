<template>
  <div data-viewable="IdentifyVocab">
    <template v-if="question">
      <span class="text-h5"> Spell the word: </span>
      <UserInputString v-model="answer" />
      <center>
        <span v-if="questionUtils.priorAttempts" class="text-h6">
          {{ question.word }}
        </span>
      </center>
      <center>
        <audio-auto-player :src="[getURL('WordAudio'), getURL('SentenceAudio'), getURL('WordAudio')]" />
      </center>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, PropType } from 'vue';
import { SpellingQuestion } from '@/word-work/questions/spelling';
import { AudioAutoPlayer, UserInputString, useViewable, useQuestionView } from '@vue-skuilder/common-ui';
import { ViewData } from '@vue-skuilder/common';

export default defineComponent({
  name: 'IdentifyVocab',

  components: {
    AudioAutoPlayer,
    UserInputString,
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
    const questionUtils = useQuestionView<SpellingQuestion>(viewableUtils, props.modifyDifficulty);

    const answer = ref('');

    // Initialize question immediately
    questionUtils.question.value = new SpellingQuestion(props.data);

    // Expose the question directly for template access
    const question = computed(() => questionUtils.question.value);

    const submit = () => {
      if (question.value) {
        questionUtils.submitAnswer(answer.value);
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
