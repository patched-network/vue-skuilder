<template>
  <div class="game-container">
    <div class="stats">
      <div class="time">Time: {{ timeLeft.toFixed(1) }}s</div>
      <div class="score">Score: {{ score }}</div>
    </div>
    <div ref="gameArea" class="game-area">
      <div
        v-for="letter in letters"
        :key="letter.id"
        class="falling-letter"
        :style="{
          left: letter.x + 'px',
          top: letter.y + 'px',
        }"
      >
        <div class="meteor-effect"></div>
        <span class="letter-text">{{ letter.char }}</span>
      </div>

      <!-- Explosion effects -->
      <div
        v-for="explosion in explosions"
        :key="explosion.id"
        class="explosion"
        :style="{
          left: explosion.x + 'px',
          top: explosion.y + 'px',
        }"
      >
        <div v-for="n in 12" :key="n" class="particle"></div>
      </div>

      <!-- Grass effect -->
      <div class="grass-container">
        <div class="grass"></div>
        <div class="grass-overlay"></div>
      </div>
      <div class="trees">
        <div
          v-for="tree in treePositions"
          :key="tree.id"
          class="tree"
          :style="{
            left: `${tree.left}%`,
            height: `${tree.height}px`,
            transform: `scale(${tree.scale})`,
          }"
        >
          <div class="tree-crown"></div>
          <div class="tree-trunk"></div>
        </div>
      </div>
    </div>
    <div v-if="gameOver" class="game-over">
      {{ gameOverMessage }}
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted, PropType } from 'vue';
import { useViewable, useQuestionView } from '@vue-skuilder/common-ui';
import { FallingLettersQuestion } from './FallingLettersQuestion';
import { ViewData } from '@vue-skuilder/common';
import { Letter, TreePosition } from './types';

// Internal game state type
interface GameStateInternal {
  currentSpeed: number;
  letterId: number;
  gameLoop: number | null;
  lastSpawn: number;
  lastUpdate: number;
  spawnInterval: number;
}

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
    // Base utilities
    const viewableUtils = useViewable(props, emit, 'FallingLettersView');
    const questionUtils = useQuestionView<FallingLettersQuestion>(viewableUtils);

    // Template-accessible state
    const gameArea = ref<HTMLElement | null>(null);
    const letters = ref<Letter[]>([]);
    const gameOver = ref(false);
    const gameOverMessage = ref('');
    const timeLeft = ref(30);
    const score = ref(0);
    const treePositions = ref<TreePosition[]>([]);

    const explosions = ref<{ id: number; x: number; y: number }[]>([]);

    // Internal game state
    const gameState = ref<GameStateInternal>({
      currentSpeed: 2,
      letterId: 0,
      gameLoop: null,
      lastSpawn: 0,
      lastUpdate: 0,
      spawnInterval: 1000,
    });

    // Game methods
    const generateTrees = () => {
      treePositions.value = Array.from({ length: 7 }, (_, i) => ({
        id: i,
        left: 20 + i * Math.random() * 30 - 10,
        height: 100 + Math.random() * 120,
        scale: 1 + Math.random() * 2,
      }));
    };

    const spawnLetter = () => {
      if (!gameArea.value) return;

      const letter: Letter = {
        id: gameState.value.letterId++,
        char: String.fromCharCode(65 + Math.floor(Math.random() * 26)),
        x: Math.random() * (gameArea.value.clientWidth - 30),
        y: -30,
      };

      letters.value.push(letter);
    };

    const win = () => {
      gameOver.value = true;
      gameOverMessage.value = 'You Win!';
      questionUtils.submitAnswer({
        lettersTyped: score.value,
        win: true,
        percentage: 1,
      });
    };

    const lose = () => {
      gameOver.value = true;
      gameOverMessage.value = 'Game Over!';
      questionUtils.submitAnswer({
        lettersTyped: score.value,
        percentage: timeLeft.value / (questionUtils.question.value?.gameLength || 30),
        win: false,
      });
    };

    const update = (timestamp: number) => {
      if (gameOver.value) return;

      const deltaTime = (timestamp - gameState.value.lastUpdate) / 1000;
      gameState.value.lastUpdate = timestamp;

      // Update time and speed
      timeLeft.value -= deltaTime;
      if (questionUtils.question.value) {
        gameState.value.currentSpeed += questionUtils.question.value.acceleration * deltaTime;
      }

      // Check win condition
      if (timeLeft.value <= 0) {
        win();
        return;
      }

      // Spawn new letters
      if (timestamp - gameState.value.lastSpawn >= gameState.value.spawnInterval) {
        spawnLetter();
        gameState.value.lastSpawn = timestamp;
        gameState.value.spawnInterval = Math.max(500, gameState.value.spawnInterval - 10);
      }

      // Update letters positions
      if (gameArea.value) {
        letters.value = letters.value.filter((letter) => {
          letter.y += gameState.value.currentSpeed;
          if (letter.y > gameArea.value!.clientHeight) {
            lose();
            return false;
          }
          return true;
        });
      }

      gameState.value.gameLoop = requestAnimationFrame(update);
    };

    const handleKeyPress = (event: KeyboardEvent) => {
      if (gameOver.value) return;

      const pressedKey = event.key.toUpperCase();
      const letterIndex = letters.value.findIndex((l) => l.char === pressedKey);

      if (letterIndex !== -1) {
        // Create explosion at letter's position
        explosions.value.push({
          id: Date.now(),
          x: letters.value[letterIndex].x,
          y: letters.value[letterIndex].y,
        });

        // Remove explosion after animation
        setTimeout(() => {
          explosions.value = explosions.value.filter((e) => e.id !== explosions.value[explosions.value.length - 1].id);
        }, 300);

        letters.value.splice(letterIndex, 1);
        score.value++;
      }
    };

    const startGame = () => {
      if (!questionUtils.question.value) {
        viewableUtils.logger.error('Question not initialized');
        return;
      }

      // Reset game state
      timeLeft.value = questionUtils.question.value.gameLength;
      score.value = 0;
      letters.value = [];
      gameOver.value = false;
      gameOverMessage.value = '';

      // Reset internal state
      gameState.value = {
        currentSpeed: questionUtils.question.value.initialSpeed,
        letterId: 0,
        gameLoop: null,
        lastSpawn: performance.now(),
        lastUpdate: performance.now(),
        spawnInterval: questionUtils.question.value.spawnInterval * 1000,
      };

      // Start game loop
      gameState.value.gameLoop = requestAnimationFrame(update);
    };

    // Lifecycle hooks
    onMounted(() => {
      try {
        // Initialize question
        questionUtils.question.value = new FallingLettersQuestion(props.data);
        questionUtils.maxAttemptsPerView.value = 1;

        // Set up event listeners
        window.addEventListener('keypress', handleKeyPress);

        // Initialize game
        generateTrees();
        startGame();
      } catch (error) {
        viewableUtils.logger.error('Error initializing game:', error);
      }
    });

    onUnmounted(() => {
      // Cleanup
      window.removeEventListener('keypress', handleKeyPress);
      if (gameState.value.gameLoop) {
        cancelAnimationFrame(gameState.value.gameLoop);
      }
    });

    // Expose to template
    return {
      ...questionUtils,
      gameArea,
      letters,
      gameOver,
      gameOverMessage,
      timeLeft,
      score,
      treePositions,
      explosions,
    };
  },
});
</script>

<style scoped>
.game-container {
  width: 100%;
  height: 400px;
  position: relative;
}

.game-area {
  z-index: 0;
  width: 100%;
  height: 100%;
  background-color: #87ceeb; /* Sky blue background */
  border: 2px solid #dee2e6;
  border-radius: 8px;
  position: relative;
  overflow: hidden;
}

.grass-container {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 40px;
  overflow: hidden;
  z-index: 3;
}

.grass {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 30px;
  background-color: #4caf50;
  border-top: 2px solid #388e3c;
}

.grass-overlay {
  z-index: 3;
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 40px;
  background: repeating-linear-gradient(
      80deg,
      transparent,
      transparent 5px,
      rgba(76, 175, 80, 0.8) 5px,
      rgba(76, 175, 80, 0.8) 10px
    ),
    repeating-linear-gradient(
      -80deg,
      transparent,
      transparent 5px,
      rgba(76, 175, 80, 0.8) 5px,
      rgba(76, 175, 80, 0.8) 10px
    );
}

.falling-letter {
  position: absolute;
  width: 40px;
  height: 45px;
  z-index: 1;
  transition: top 16ms linear;
}

.meteor-effect {
  position: absolute;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at 40% 40%, #ff6b6b, #c92a2a);
  border-radius: 50%;
  box-shadow: 0 0 10px #ff8f8f, 0 0 20px #ff6b6b, 0 0 30px #c92a2a, 0 4px 8px rgba(0, 0, 0, 0.4);
  animation: meteorSpin 1s linear infinite;

  &::before {
    content: '';
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    width: 2px;
    height: 20px;
    background: linear-gradient(to top, rgba(255, 107, 107, 0.8), rgba(255, 107, 107, 0.4), transparent);
    filter: blur(1px);
  }

  &::after {
    content: '';
    position: absolute;
    top: -5px;
    left: 50%;
    transform: translateX(-50%);
    width: 15px;
    height: 15px;
    background: radial-gradient(circle at center, rgba(255, 255, 255, 0.8), rgba(255, 143, 143, 0.4), transparent);
    filter: blur(2px);
  }
}

.letter-text {
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.5), 0 0 8px rgba(0, 0, 0, 0.3);
  z-index: 1;
}

@keyframes meteorSpin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.stats {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1;
  font-size: 18px;
  color: #333;
  background-color: rgba(255, 255, 255, 0.8);
  padding: 5px 10px;
  border-radius: 4px;
  z-index: 4;
}

.game-over {
  z-index: 3;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 36px;
  font-weight: bold;
  color: #333;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 20px;
  border-radius: 8px;
  z-index: 4;
}

.time,
.score {
  margin: 5px 0;
}

.trees {
  position: absolute;
  bottom: 20px; /* Adjust to sit on grass */
  width: 100%;
  height: 0;
  z-index: 2;
}

.tree {
  position: absolute;
  bottom: 0;
  transform-origin: bottom center;
}

.tree-crown {
  z-index: 2;
  position: absolute;
  bottom: 15px;
  left: 50%;
  transform: translateX(-50%);
  width: 30px;
  height: 40px;
  background: radial-gradient(circle at 50% 25%, #2d5a27, #1a472a);
  border-radius: 50% 50% 20% 20%;
  box-shadow: -2px 3px 0 #1a472a, 2px 3px 0 #1a472a;
}

.tree-trunk {
  z-index: 2;
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 6px;
  height: 15px;
  background: linear-gradient(to right, #3e2723 20%, #5d4037 50%, #3e2723 80%);
  border-radius: 2px;
}

.grass,
.grass-overlay {
  z-index: 3;
}

.explosion {
  position: absolute;
  width: 40px;
  height: 40px;
  pointer-events: none;
  z-index: 2;
}

.particle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: linear-gradient(to right, #ff8f8f, #ff6b6b);
  box-shadow: 0 0 10px #ff6b6b, 0 0 20px #ff8f8f;
  animation: explode 0.3s ease-out forwards;
}

@keyframes explode {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(0) rotate(45deg);
    opacity: 0;
  }
}

/* Generate different angles for particles */
.particle:nth-child(1) {
  transform: rotate(0deg) translate(20px);
}
.particle:nth-child(2) {
  transform: rotate(30deg) translate(20px);
}
.particle:nth-child(3) {
  transform: rotate(60deg) translate(20px);
}
.particle:nth-child(4) {
  transform: rotate(90deg) translate(20px);
}
.particle:nth-child(5) {
  transform: rotate(120deg) translate(20px);
}
.particle:nth-child(6) {
  transform: rotate(150deg) translate(20px);
}
.particle:nth-child(7) {
  transform: rotate(180deg) translate(20px);
}
.particle:nth-child(8) {
  transform: rotate(210deg) translate(20px);
}
.particle:nth-child(9) {
  transform: rotate(240deg) translate(20px);
}
.particle:nth-child(10) {
  transform: rotate(270deg) translate(20px);
}
.particle:nth-child(11) {
  transform: rotate(300deg) translate(20px);
}
.particle:nth-child(12) {
  transform: rotate(330deg) translate(20px);
}
</style>
