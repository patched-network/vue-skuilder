<template>
  <div data-viewable="LetterQuestionView">
    <template v-if="question">
      <p class="text-h5">Type this letter!</p>
      <div ref="letterDisplay" class="letter-display">{{ question.letter }}</div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted, PropType } from 'vue';
import { TypeLetterQuestion } from './index';
import { useViewable, useQuestionView } from '@vue-skuilder/common-ui';
import { ViewData } from '@vue-skuilder/common';

export default defineComponent({
  name: 'LetterQuestionView',

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
    const viewableUtils = useViewable(props, emit, 'LetterQuestionView');
    const questionUtils = useQuestionView<TypeLetterQuestion>(viewableUtils);
    const letterDisplay = ref<HTMLElement | null>(null);

    // Initialize question immediately
    questionUtils.question.value = new TypeLetterQuestion(props.data);

    // Expose the question directly for template access
    const question = computed(() => questionUtils.question.value);

    const handleKeyPress = (event: KeyboardEvent) => {
      if (!question.value) return;

      const pressedKey = event.key.toLowerCase();
      const targetKey = question.value.letter.toLowerCase();

      if (pressedKey === targetKey) {
        letterDisplay.value?.classList.add('pressed');

        // Remove pressed class and submit answer after key release
        const handleKeyUp = (e: KeyboardEvent) => {
          if (e.key.toLowerCase() === targetKey) {
            letterDisplay.value?.classList.remove('pressed');
            questionUtils.submitAnswer(pressedKey);
            window.removeEventListener('keyup', handleKeyUp);
          }
        };

        window.addEventListener('keyup', handleKeyUp);
      } else {
        questionUtils.submitAnswer(pressedKey);
      }
    };

    onMounted(() => {
      window.addEventListener('keypress', handleKeyPress);
    });

    onUnmounted(() => {
      window.removeEventListener('keypress', handleKeyPress);
    });

    return {
      ...questionUtils,
      ...viewableUtils,
      letterDisplay,
      question,
    };
  },
});
</script>

<style scoped>
.letter-display {
  font-size: 48px;
  font-weight: bold;
  font-family: monospace;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f8f9fa;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  box-shadow: 0 2px 0 #dee2e6, 0 3px 3px rgba(0, 0, 0, 0.2);
  margin: 20px auto;
  color: #333;
  text-transform: uppercase;
}

.letter-display.pressed {
  box-shadow: 0 0 0 #dee2e6, 0 1px 2px rgba(0, 0, 0, 0.2);
  transform: translateY(2px);
}
</style>
