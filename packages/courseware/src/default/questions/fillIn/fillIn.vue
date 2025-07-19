<template>
  <div data-viewable="FillInView">
    <audio-auto-player v-if="hasAudio" :src="audioURL" />
    <template v-if="hasImage">
      <img v-for="(url, index) in imageURLs" :key="index" :src="url" />
    </template>
    <!-- Add v-if to prevent undefined markdown -->
    <markdown-renderer v-if="markdownText" :md="markdownText" />
    <radio-multiple-choice v-if="question?.options" :choice-list="truncatedOptions" />
    <div v-else-if="priorAttempts == 1" class="text-center text-h6">
      <span>{{ obscuredAnswer }}</span>
    </div>
    <div v-else-if="priorAttempts == 2" class="text-center text-h6">
      <span>{{ someAnswer }}</span>
    </div>
    <v-card-actions v-if="!isQuestion">
      <v-spacer></v-spacer>
      <v-btn color="primary" autofocus="autofocus" @click="handleNext"> Next </v-btn>
    </v-card-actions>
  </div>
</template>

<script lang="ts">
import { defineAsyncComponent, defineComponent, ref, computed, PropType, onMounted, onUnmounted, watch } from 'vue';
import { useViewable, useQuestionView, AudioAutoPlayer, RadioMultipleChoice } from '@vue-skuilder/common-ui';
import _ from 'lodash';
import { BlanksCard } from './index';
import gradeSpellingAttempt from './blanksCorrection';
import { ViewData } from '@vue-skuilder/common';

export default defineComponent({
  name: 'FillInView',

  components: {
    // Previously:
    // MarkdownRenderer: defineAsyncComponent(() => import('@courseware/base-course/Components/MarkdownRenderer.vue')),
    //
    // Another option:
    MarkdownRenderer: defineAsyncComponent(() =>
      import('@vue-skuilder/common-ui').then((module) => module.MarkdownRenderer)
    ),
    // MarkdownRenderer,
    RadioMultipleChoice,
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
    const viewableUtils = useViewable(props, emit, 'FillInView');
    const questionUtils = useQuestionView<BlanksCard>(viewableUtils);

    questionUtils.question.value = new BlanksCard(props.data);

    // State
    const shuffledOptions = ref<string[] | undefined>();
    const question = computed(() => {
      if (!questionUtils.question.value) {
        viewableUtils.logger.error('Question not initialized');
        throw new Error('Question not initialized');
      }
      return questionUtils.question.value;
    });

    onMounted(() => {
      try {
        if (!questionUtils.question.value) {
          questionUtils.question.value = new BlanksCard(props.data);
        }

        if (questionUtils.question.value.options) {
          const truncatedList = getTruncatedList();
          shuffledOptions.value = _.shuffle(truncatedList);
        }
      } catch (error) {
        viewableUtils.logger.error('Failed to initialize question:', error);
      }
    });

    onUnmounted(() => {
      questionUtils.question.value = undefined;
    });

    // Computed properties
    const truncatedOptions = computed(() => shuffledOptions.value);

    const hasImage = computed(() => !!props.data[0]['image-1']);

    const imageURLs = computed(() => {
      if (!hasImage.value) return [''];

      const urls: string[] = [];
      let i = 1;
      while (props.data[0][`image-${i}`]) {
        urls.push(URL.createObjectURL(props.data[0][`image-${i}`] as Blob));
        i++;
      }
      return urls;
    });

    const hasAudio = computed(() => !!props.data[0]['audio-1']);

    const markdownText = computed(() => {
      return question.value?.mdText || ''; // Provide empty string as fallback
    });

    const audioURL = computed(() => {
      if (!hasAudio.value) return [''];

      const urls: string[] = [];
      let i = 1;
      while (props.data[0][`audio-${i}`]) {
        urls.push(URL.createObjectURL(props.data[0][`audio-${i}`] as Blob));
        i++;
      }
      return urls;
    });

    const someAnswer = computed(() => {
      if (question.value.answers) {
        return question.value.answers[Math.floor(question.value.answers.length * Math.random())];
      } else {
        throw new Error('No answers provided');
      }
    });

    const obscuredAnswer = computed(() => {
      const sa = someAnswer.value;

      console.log(`Prior answers: ${questionUtils.priorAnswers.value}`);

      if (
        sa &&
        questionUtils.priorAnswers.value[0]?.[0] &&
        questionUtils.priorAnswers.value[0][1] === 'UserInputString'
      ) {
        return gradeSpellingAttempt(questionUtils.priorAnswers.value[0][0] as string, sa);
      } else {
        console.log(`found no UserInputString`);
      }

      if (someAnswer.value) {
        let obscuredAnswer = '';
        for (let i = 0; i < someAnswer.value.length; i++) {
          obscuredAnswer += '_ ';
        }
        return obscuredAnswer;
      }

      return '';
    });

    const isQuestion = computed(() => {
      return !!(question.value!.answers && question.value.answers.length > 0);
    });

    // Methods
    const getTruncatedList = (): string[] | undefined => {
      if (!question.value?.options) return;

      if (question.value.options.length <= 6) {
        return question.value.options;
      }

      const truncatedList = [];
      // include one answer
      truncatedList.push(question.value.answers![Math.floor(Math.random() * question.value.answers!.length)]);

      // construct a list of all non-answers
      let distractors: string[] = _.shuffle(
        question.value.options.filter((o: string) => question.value.answers?.indexOf(o) === -1)
      );

      if (props.modifyDifficulty) {
        console.log(`Modifying difficulty: ${props.modifyDifficulty}`);

        // Adjust number of distractors based on difficulty
        if (props.modifyDifficulty < -200) {
          distractors = distractors.slice(0, 1);
        } else if (props.modifyDifficulty < -150) {
          distractors = distractors.slice(0, 2);
        } else if (props.modifyDifficulty < -100) {
          distractors = distractors.slice(0, 3);
        } else if (props.modifyDifficulty < -50) {
          distractors = distractors.slice(0, 4);
        } else {
          distractors = distractors.slice(0, 5);
        }
      }

      truncatedList.push(...distractors.slice(0, 5));
      return truncatedList;
    };

    const handleNext = () => {
      questionUtils.submitAnswer('');
    };

    /**
     * update the question whenever the data changes
     */
    watch(
      () => props.data,
      (newdata) => {
        try {
          questionUtils.question.value = new BlanksCard(newdata);
          // Update shuffled options whenever question changes
          if (questionUtils.question.value?.options) {
            const truncatedList = getTruncatedList();
            shuffledOptions.value = _.shuffle(truncatedList);
          }
        } catch (error) {
          viewableUtils.logger.error('Failed to initialize/update question:', error);
        }
      },
      { deep: true }
    );

    return {
      ...viewableUtils,
      ...questionUtils,
      question,
      truncatedOptions,
      hasImage,
      imageURLs,
      hasAudio,
      audioURL,
      obscuredAnswer,
      someAnswer,
      isQuestion,
      handleNext,
      markdownText,
    };
  },
});
</script>

<style lang="css" scoped>
canvas {
  display: block;
  margin-left: auto;
  margin-right: auto;
  padding: 10px;
}

img {
  display: block;
  margin-left: auto;
  margin-right: auto;
  max-width: 100%;
  max-height: 60vh;
  padding: 10px;
}
</style>
