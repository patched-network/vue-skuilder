<template>
  <div class="falling-letters" :class="{ miss: missFlash }">
    <div ref="gameArea" class="sky">
      <div class="stars stars-far"></div>
      <div class="stars stars-near"></div>

      <div class="hud">
        <div class="hud-progress" :title="`${timeLeft.toFixed(1)}s left`">
          <div class="hud-progress-fill" :style="{ transform: `scaleX(${progress})` }"></div>
        </div>
        <span class="hud-time">{{ Math.max(0, timeLeft).toFixed(1) }}s</span>
        <span class="hud-score">{{ score }}</span>
      </div>

      <div
        v-for="letter in letters"
        :key="letter.id"
        class="meteor"
        :class="{ danger: letter.y > dangerY }"
        :style="{ left: `${letter.x}%`, transform: `translate(-50%, ${letter.y}px)` }"
      >
        <span class="meteor-tail"></span>
        <span class="meteor-core">{{ letter.char }}</span>
      </div>

      <div
        v-for="burst in bursts"
        :key="burst.id"
        class="burst"
        :class="{ impact: burst.impact }"
        :style="{ left: `${burst.x}%`, transform: `translate(-50%, ${burst.y}px)` }"
      >
        <span class="burst-ring"></span>
        <span v-for="n in 10" :key="n" class="burst-spark" :style="{ '--angle': `${n * 36}deg` }"></span>
      </div>

      <div class="skyline">
        <div
          v-for="b in buildings"
          :key="b.id"
          class="building"
          :style="{ left: `${b.left}%`, width: `${b.width}%`, height: `${b.height}%` }"
        ></div>
      </div>
      <div class="ground"></div>

      <div v-if="countdown > 0" class="overlay countdown">{{ countdown }}</div>
      <div v-else-if="!started" class="overlay hint">type the letters before they land</div>

      <div v-if="gameOver" class="overlay result" :class="{ won: result?.win }">
        <div class="result-title">{{ result?.win ? 'City saved' : 'Impact' }}</div>
        <div class="result-detail">
          {{ score }} {{ score === 1 ? 'letter' : 'letters' }} ·
          {{ result?.win ? 'survived the full' : `held out ${Math.round((result?.percentage ?? 0) * 100)}% of the` }}
          {{ gameLength }}s
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted, PropType } from 'vue';
import { useViewable, useQuestionView } from '@vue-skuilder/common-ui';
import { ViewData } from '@vue-skuilder/common';
import { FallingLettersQuestion, Score } from './FallingLettersQuestion';
import { Letter, Burst, Building } from './types';

/** `initialSpeed` and `acceleration` are in "pixels per frame at 60 fps", as they always were. */
const FPS_BASE = 60;
const LETTER_SIZE = 44;
const COUNTDOWN_SECONDS = 3;

export default defineComponent({
  name: 'FallingLettersView',

  emits: ['emitResponse'],

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
    const viewableUtils = useViewable(props, emit, 'FallingLettersView');
    const questionUtils = useQuestionView<FallingLettersQuestion>(viewableUtils);
    questionUtils.question.value = new FallingLettersQuestion(props.data);
    questionUtils.maxAttemptsPerView.value = 1;

    const q = questionUtils.question.value;
    const gameLength = q.gameLength > 0 ? q.gameLength : 30;
    const spawnEvery = q.spawnInterval > 0 ? q.spawnInterval : 1;

    const gameArea = ref<HTMLElement | null>(null);
    const letters = ref<Letter[]>([]);
    const bursts = ref<Burst[]>([]);
    const buildings = ref<Building[]>(makeSkyline());
    const timeLeft = ref(gameLength);
    const score = ref(0);
    const countdown = ref(COUNTDOWN_SECONDS);
    const started = ref(false);
    const gameOver = ref(false);
    const result = ref<Score | null>(null);
    const missFlash = ref(false);
    const areaHeight = ref(400);

    const progress = computed(() => Math.min(1, Math.max(0, 1 - timeLeft.value / gameLength)));
    // Letters below this line glow red: they are about to land.
    const groundY = computed(() => areaHeight.value - 48);
    const dangerY = computed(() => groundY.value * 0.72);

    let nextId = 0;
    let speed = q.initialSpeed * FPS_BASE; // px per second
    let sinceSpawn = spawnEvery; // spawn one at once
    let lastFrame = 0;
    let frame: number | null = null;
    let countdownTimer: ReturnType<typeof setInterval> | null = null;
    const timers = new Set<ReturnType<typeof setTimeout>>();

    function later(fn: () => void, ms: number) {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    }

    function addBurst(x: number, y: number, impact: boolean) {
      const burst = { id: nextId++, x, y, impact };
      bursts.value.push(burst);
      later(() => {
        bursts.value = bursts.value.filter((b) => b.id !== burst.id);
      }, 600);
    }

    function spawnLetter() {
      // Avoid a letter that's already falling, so a key press is never ambiguous.
      const onScreen = new Set(letters.value.map((l) => l.char));
      let char = '';
      for (let i = 0; i < 8 && (!char || onScreen.has(char)); i++) {
        char = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      }
      letters.value.push({ id: nextId++, char, x: 6 + Math.random() * 88, y: -LETTER_SIZE });
    }

    function finish(score_: Score) {
      if (gameOver.value) return;
      gameOver.value = true;
      result.value = score_;
      stopLoop();
      questionUtils.submitAnswer(score_);
    }

    const win = () => finish({ win: true, lettersTyped: score.value, percentage: 1 });

    const lose = () =>
      finish({
        win: false,
        lettersTyped: score.value,
        // the share of the game survived
        percentage: progress.value,
      });

    function tick(now: number) {
      // Clamp the step: after a background tab or a stall, carry on rather than jump.
      const dt = Math.min(0.1, (now - lastFrame) / 1000);
      lastFrame = now;
      if (gameArea.value) areaHeight.value = gameArea.value.clientHeight;

      timeLeft.value -= dt;
      if (timeLeft.value <= 0) {
        timeLeft.value = 0;
        win();
        return;
      }

      speed += q.acceleration * FPS_BASE * dt;
      sinceSpawn += dt;
      if (sinceSpawn >= spawnEvery) {
        sinceSpawn -= spawnEvery;
        spawnLetter();
      }

      const ground = groundY.value;
      let landed: Letter | null = null;
      letters.value = letters.value.filter((l) => {
        l.y += speed * dt;
        if (l.y + LETTER_SIZE / 2 >= ground) {
          landed = landed ?? l;
          return false;
        }
        return true;
      });
      if (landed) {
        addBurst((landed as Letter).x, ground - LETTER_SIZE / 2, true);
        lose();
        return;
      }

      frame = requestAnimationFrame(tick);
    }

    function stopLoop() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    }

    function start() {
      started.value = true;
      lastFrame = performance.now();
      frame = requestAnimationFrame(tick);
    }

    function onKeydown(event: KeyboardEvent) {
      if (!started.value || gameOver.value) return;
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (!/^[a-z]$/i.test(event.key)) return;

      const key = event.key.toUpperCase();
      // Of the matching letters, take the one nearest the ground.
      let hit: Letter | null = null;
      for (const l of letters.value) if (l.char === key && (!hit || l.y > hit.y)) hit = l;

      if (hit) {
        const h = hit;
        letters.value = letters.value.filter((l) => l.id !== h.id);
        addBurst(h.x, h.y, false);
        score.value++;
      } else {
        missFlash.value = true;
        later(() => (missFlash.value = false), 160);
      }
    }

    onMounted(() => {
      window.addEventListener('keydown', onKeydown);
      countdownTimer = setInterval(() => {
        countdown.value--;
        if (countdown.value <= 0) {
          if (countdownTimer) clearInterval(countdownTimer);
          countdownTimer = null;
          start();
        }
      }, 700);
    });

    onUnmounted(() => {
      window.removeEventListener('keydown', onKeydown);
      if (countdownTimer) clearInterval(countdownTimer);
      timers.forEach(clearTimeout);
      stopLoop();
    });

    return {
      ...questionUtils,
      gameArea,
      letters,
      bursts,
      buildings,
      timeLeft,
      score,
      countdown,
      started,
      gameOver,
      result,
      missFlash,
      progress,
      dangerY,
      gameLength,
    };
  },
});

function makeSkyline(): Building[] {
  const out: Building[] = [];
  let left = -2;
  let id = 0;
  while (left < 100) {
    const width = 5 + Math.random() * 7;
    out.push({ id: id++, left, width, height: 6 + Math.random() * 14 });
    left += width - 0.5;
  }
  return out;
}
</script>

<style scoped>
.falling-letters {
  --fl-meteor: #ff8a3d;
  --fl-meteor-hot: #ffd27a;
  --fl-danger: #ff4d5e;
  --fl-sky-top: #070b1f;
  --fl-sky-bottom: #2b2552;
  width: 100%;
  height: 400px;
  border-radius: 12px;
  outline: 2px solid transparent;
  transition: outline-color 0.12s;
}

.falling-letters.miss {
  outline-color: color-mix(in srgb, var(--fl-danger) 70%, transparent);
}

.sky {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 12px;
  background: linear-gradient(to bottom, var(--fl-sky-top), var(--fl-sky-bottom));
  font-family: ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace;
  user-select: none;
}

/* Two layers of stars, drawn with gradients. */
.stars {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.stars-far {
  background-image:
    radial-gradient(1px 1px at 10% 20%, #fff8, transparent), radial-gradient(1px 1px at 30% 70%, #fff6, transparent),
    radial-gradient(1px 1px at 55% 35%, #fff7, transparent), radial-gradient(1px 1px at 75% 15%, #fff5, transparent),
    radial-gradient(1px 1px at 90% 55%, #fff6, transparent);
  background-size: 180px 140px;
}
.stars-near {
  background-image:
    radial-gradient(1.5px 1.5px at 20% 40%, #fffa, transparent),
    radial-gradient(1.5px 1.5px at 65% 80%, #fff9, transparent), radial-gradient(2px 2px at 85% 25%, #fffb, transparent);
  background-size: 260px 200px;
  animation: twinkle 4s ease-in-out infinite alternate;
}

.hud {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #e8e9f3;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.hud-progress {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: #ffffff1f;
  overflow: hidden;
}
.hud-progress-fill {
  height: 100%;
  background: linear-gradient(to right, #6ee7b7, #a5b4fc);
  transform-origin: left;
}
.hud-score::before {
  content: '✦ ';
  color: var(--fl-meteor-hot);
}

.meteor {
  position: absolute;
  top: 0;
  width: 44px;
  height: 44px;
  z-index: 3;
  will-change: transform;
}
.meteor-tail {
  position: absolute;
  left: 50%;
  bottom: 50%;
  width: 14px;
  height: 64px;
  transform: translateX(-50%);
  border-radius: 7px;
  background: linear-gradient(to top, color-mix(in srgb, var(--fl-meteor) 70%, transparent), transparent);
  filter: blur(3px);
}
.meteor-core {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, var(--fl-meteor-hot), var(--fl-meteor) 55%, #b3401e);
  box-shadow: 0 0 18px color-mix(in srgb, var(--fl-meteor) 70%, transparent);
  color: #1b0d05;
  font-size: 22px;
  font-weight: 800;
}
.meteor.danger .meteor-core {
  background: radial-gradient(circle at 35% 30%, #ffd0d4, var(--fl-danger) 55%, #8f1020);
  box-shadow: 0 0 24px var(--fl-danger);
  color: #fff;
  animation: pulse 0.35s ease-in-out infinite alternate;
}
.meteor.danger .meteor-tail {
  background: linear-gradient(to top, color-mix(in srgb, var(--fl-danger) 70%, transparent), transparent);
}

.burst {
  position: absolute;
  top: 0;
  width: 44px;
  height: 44px;
  z-index: 4;
  pointer-events: none;
}
.burst-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid var(--fl-meteor-hot);
  animation: ring 0.45s ease-out forwards;
}
.burst-spark {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 5px;
  height: 5px;
  margin: -2.5px;
  border-radius: 50%;
  background: var(--fl-meteor-hot);
  box-shadow: 0 0 8px var(--fl-meteor);
  animation: spark 0.5s ease-out forwards;
}
.burst.impact .burst-ring {
  border-color: var(--fl-danger);
  animation-duration: 0.6s;
}
.burst.impact .burst-spark {
  background: var(--fl-danger);
  box-shadow: 0 0 10px var(--fl-danger);
}

.skyline {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 18px;
  height: 100%;
  z-index: 2;
  pointer-events: none;
}
.building {
  position: absolute;
  bottom: 0;
  background-color: #0b0e22;
  /* lit windows */
  background-image:
    repeating-linear-gradient(to bottom, transparent 0 6px, #ffd27a22 6px 8px),
    repeating-linear-gradient(to right, transparent 0 5px, #0b0e22 5px 9px);
  border-top-left-radius: 2px;
  border-top-right-radius: 2px;
}
.ground {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 18px;
  z-index: 2;
  background: #05060f;
  box-shadow: 0 -1px 12px color-mix(in srgb, var(--fl-danger) 35%, transparent);
}

.overlay {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 6px;
  color: #f3f4ff;
  text-align: center;
  pointer-events: none;
}
.countdown {
  font-size: 64px;
  font-weight: 800;
  text-shadow: 0 0 24px #a5b4fc;
}
.hint {
  font-size: 15px;
  opacity: 0.8;
}
.result {
  background: #070b1fb3;
  backdrop-filter: blur(2px);
}
.result-title {
  font-size: 34px;
  font-weight: 800;
  color: var(--fl-danger);
}
.result.won .result-title {
  color: #6ee7b7;
}
.result-detail {
  font-size: 15px;
  opacity: 0.85;
}

@keyframes pulse {
  to {
    filter: brightness(1.25);
  }
}
@keyframes ring {
  from {
    transform: scale(0.4);
    opacity: 1;
  }
  to {
    transform: scale(2.2);
    opacity: 0;
  }
}
@keyframes spark {
  from {
    transform: rotate(var(--angle)) translateX(0);
    opacity: 1;
  }
  to {
    transform: rotate(var(--angle)) translateX(34px);
    opacity: 0;
  }
}
@keyframes twinkle {
  to {
    opacity: 0.55;
  }
}

@media (prefers-reduced-motion: reduce) {
  .stars-near,
  .meteor.danger .meteor-core {
    animation: none;
  }
}
</style>
