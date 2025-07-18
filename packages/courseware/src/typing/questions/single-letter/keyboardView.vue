<template>
  <div data-viewable="KeyboardQuestionView">
    <p class="text-h5">Type this letter!</p>
    <div class="keyboard">
      <!-- Row 1: Q to P -->
      <div class="keyboard-row">
        <div
          v-for="key in 'QWERTYUIOP'.split('')"
          :key="key"
          :class="['key', { highlight: key === question?.letter?.toUpperCase() }]"
        >
          {{ key }}
        </div>
      </div>
      <!-- Row 2: A to L -->
      <div class="keyboard-row">
        <div
          v-for="key in 'ASDFGHJKL'.split('')"
          :key="key"
          :class="['key', { highlight: key === question?.letter?.toUpperCase() }]"
        >
          {{ key }}
        </div>
      </div>
      <!-- Row 3: Z to M -->
      <div class="keyboard-row">
        <div
          v-for="key in 'ZXCVBNM'.split('')"
          :key="key"
          :class="['key', { highlight: key === question?.letter?.toUpperCase() }]"
        >
          {{ key }}
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, onUnmounted, computed, PropType } from 'vue';
import { useViewable, useQuestionView } from '@vue-skuilder/common-ui';
import { TypeLetterQuestion } from './index';
import { ViewData } from '@vue-skuilder/common';

export default defineComponent({
  name: 'KeyboardQuestionView',

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
    const viewableUtils = useViewable(props, emit, 'KeyboardQuestionView');
    const questionUtils = useQuestionView<TypeLetterQuestion>(viewableUtils);

    // Initialize question immediately
    questionUtils.question.value = new TypeLetterQuestion(props.data);

    // Expose the question directly for template access
    const question = computed(() => questionUtils.question.value);

    const handleKeyPress = (event: KeyboardEvent) => {
      const pressedKey = event.key.toLowerCase();
      const targetKey = question.value?.letter.toLowerCase();

      if (pressedKey === targetKey) {
        const keyElement = document.querySelector('.key.highlight');
        keyElement?.classList.add('pressed');

        const handleKeyUp = (e: KeyboardEvent) => {
          if (e.key.toLowerCase() === targetKey) {
            keyElement?.classList.remove('pressed');
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
      ...viewableUtils,
      ...questionUtils,
      question,
    };
  },
});
</script>

<style scoped>
.keyboard-layout {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: left;
  padding: 2px;
}

.keyboard {
  background-color: #e9ecef;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.keyboard-row {
  display: flex;
  justify-content: left;
  margin-bottom: 8px;
}
.keyboard-row:nth-child(2) {
  padding-left: 20px;
}

.keyboard-row:nth-child(3) {
  padding-left: 45px;
}

.key {
  width: 40px;
  height: 40px;
  margin: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: white;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-family: monospace;
  font-size: 18px;
  color: #495057;
  box-shadow: 0 2px 0 #ced4da;
  user-select: none;
}

.key.highlight {
  background-color: #007bff;
  color: white;
  border-color: #0056b3;
  box-shadow: 0 2px 0 #0056b3;
}

.key.highlight.pressed {
  transform: translateY(2px);
  box-shadow: 0 0 0 #0056b3;
}
</style>
