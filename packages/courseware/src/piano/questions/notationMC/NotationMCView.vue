<template>
  <div data-viewable="NotationMCView">
    <div class="text-h5">Listen, then choose the matching notation.</div>

    <div class="progress-container">
      <div ref="progressBar" class="progress-bar"></div>
    </div>

    <v-btn color="primary" :disabled="!canPlay" :loading="loading" @click="play">
      Play again <v-icon end>volume_up</v-icon>
    </v-btn>

    <div class="options">
      <v-card
        v-for="(option, i) in shuffledOptions"
        :key="i"
        class="option-card"
        :class="{
          highlighted: highlighted === i && !submitted,
          correct: submitted && option === question.correct,
          incorrect: submitted && selectedIndex === i && option !== question.correct,
        }"
        :disabled="submitted"
        @click="select(i)"
      >
        <span class="option-key">{{ i + 1 }}</span>
        <music-score-renderer :abc-string="noMeter(option)" />
      </v-card>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onBeforeUnmount, PropType } from 'vue';
import { ViewData } from '@vue-skuilder/common';
import { useViewable, useQuestionView, SkldrMouseTrap } from '@vue-skuilder/common-ui';
import type { HotKey } from '@vue-skuilder/common-ui';
import { playAbc } from '../../utility/abcPlayer';
import { NotationMCQuestion } from '.';
import MusicScoreRenderer from '@courseware/components/MusicScoreRender.vue';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default defineComponent({
  name: 'NotationMCView',

  components: { MusicScoreRenderer },

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
    const viewableUtils = useViewable(props, emit, 'NotationMCView');
    const questionUtils = useQuestionView<NotationMCQuestion>(viewableUtils);

    const question = computed(() => new NotationMCQuestion(props.data));
    questionUtils.question.value = question.value;

    const loading = ref(false);
    const canPlay = ref(true);
    const submitted = ref(false);
    const selectedIndex = ref<number | null>(null);
    const highlighted = ref<number | null>(null);
    const progressBar = ref<HTMLDivElement>();
    const shuffledOptions = ref<string[]>([]);

    shuffledOptions.value = shuffle([question.value.correct, ...question.value.distractors]);
    const n = shuffledOptions.value.length;

    const runProgressBar = (durationMs: number) => {
      if (!progressBar.value) return;
      progressBar.value.style.animationName = '';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (progressBar.value) {
            progressBar.value.style.animationDuration = durationMs + 'ms';
            progressBar.value.style.animationName = 'notation-mc-progress';
          }
        });
      });
    };

    const play = async () => {
      canPlay.value = false;
      loading.value = true;
      try {
        const durationMs = await playAbc(question.value.correct, 75);
        loading.value = false;
        runProgressBar(durationMs);
        setTimeout(() => { canPlay.value = true; }, durationMs);
      } catch (e) {
        loading.value = false;
        canPlay.value = true;
        viewableUtils.logger.warn(`[NotationMCView] playAbc failed: ${e}`);
      }
    };

    const select = (i: number) => {
      if (submitted.value) return;
      selectedIndex.value = i;
      submitted.value = true;
      questionUtils.submitAnswer({ selection: i, options: shuffledOptions.value });
    };

    const move = (delta: number) => {
      if (submitted.value) return;
      highlighted.value = highlighted.value === null
        ? (delta > 0 ? 0 : n - 1)
        : ((highlighted.value + delta + n) % n);
    };

    const noMeter = (abc: string) => abc.replace(/^M:.*$/m, 'M:none');

    const confirm = () => {
      if (highlighted.value !== null) select(highlighted.value);
    };

    const bindings: HotKey[] = [
      ...shuffledOptions.value.map((_, i) => ({
        hotkey: String(i + 1),
        command: `Select option ${i + 1}`,
        callback: () => select(i),
      })),
      { hotkey: 'down',  command: 'Next option',     callback: () => move(1)  },
      { hotkey: 'right', command: 'Next option',     callback: () => move(1)  },
      { hotkey: 'up',    command: 'Prev option',     callback: () => move(-1) },
      { hotkey: 'left',  command: 'Prev option',     callback: () => move(-1) },
      { hotkey: 'enter', command: 'Confirm option',  callback: confirm        },
      { hotkey: 'space', command: 'Play again',      callback: () => { if (canPlay.value) play(); } },
    ];

    onMounted(() => {
      SkldrMouseTrap.addBinding(bindings);
    });

    onBeforeUnmount(() => {
      bindings.forEach((b) => SkldrMouseTrap.removeBinding(b.hotkey));
    });

    return {
      ...viewableUtils,
      ...questionUtils,
      question,
      loading,
      canPlay,
      submitted,
      selectedIndex,
      highlighted,
      noMeter,
      shuffledOptions,
      progressBar,
      play,
      select,
    };
  },
});
</script>

<style scoped>
.progress-container {
  background-color: #eee;
  height: 5px;
  margin: 12px 0;
}

.progress-bar {
  background-color: #1976d2;
  height: 5px;
  width: 0%;
  animation-timing-function: linear;
}

@keyframes notation-mc-progress {
  0%   { width: 0%; }
  100% { width: 100%; }
}

.options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.option-card {
  cursor: pointer;
  padding: 8px 8px 8px 36px;
  position: relative;
  transition: box-shadow 0.15s;
}

.option-card:hover:not([disabled]) {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.option-key {
  position: absolute;
  top: 10px;
  left: 10px;
  font-size: 0.75rem;
  color: #888;
  font-weight: 600;
  user-select: none;
}

.option-card.highlighted {
  outline: 2px solid #1976d2;
}

.option-card.correct {
  outline: 3px solid #4caf50;
}

.option-card.incorrect {
  outline: 3px solid #f44336;
}
</style>
