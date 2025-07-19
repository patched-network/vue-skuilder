<!-- src/courses/chess/components/base/ChessBoard.vue -->
<template>
  <div class="chess-board-container">
    <div v-if="showCoordinates" class="ranks-labels">
      <!-- rank labels -->
    </div>
    <div class="board-and-files">
      <div ref="boardElement" class="board"></div>
      <div v-if="showCoordinates" class="files-labels">
        <!-- file labels -->
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { Chessground } from '../chessground/chessground';
import { Config } from '../chessground/config';
import type { Api as CgAPI } from '../chessground/api';
import type { ChessPosition, Move } from './types';
import { Dests, Key, PiecesDiff, Piece as cgPiece } from '../chessground/types';
import { Piece as cjsPiece, Square } from 'chess.js';
import ChessUtils from '../chessUtils';

export interface AnimationMove {
  from: Key;
  to: Key;
  /**
   * Optional piece - not necessary to provide
   * if the piece is already expected at the `from` square.
   */
  movingPiece?: cgPiece | cjsPiece;
  /**
   * Optional pieces to place before animating the move.
   */
  pieces?: [cgPiece | cjsPiece, Key][];
  duration?: number;
}

export interface ShowMoves {
  square: Square;
  /**
   * Optional piece - if not already present
   */
  piece?: cgPiece | cjsPiece;
  dests: Key[];
  duration?: number;
}

interface ChessBoardExpose {
  playAnimations: (moves: AnimationMove[]) => Promise<void> | void;
  showMoves: (sm: ShowMoves) => Promise<void> | void;
  updateConfig: (config: Config) => void;
}

const playAnimation = async (move: AnimationMove, duration: number = 400) => {
  if (!board.value) return;

  console.log(`[ChessBoard]: animating ${JSON.stringify(move)}`);

  // Handle piece placement if specified
  if (move.movingPiece || move.pieces) {
    const placedPieces: PiecesDiff = new Map();
    if (move.movingPiece) {
      placedPieces.set(move.from, ChessUtils.asCgPiece(move.movingPiece));
    }
    if (move.pieces) {
      for (const p of move.pieces) {
        placedPieces.set(p[1], ChessUtils.asCgPiece(p[0]));
      }
    }
    board.value.setPieces(placedPieces);

    await new Promise((resolve) => setTimeout(resolve, duration / 2));
  }
  // Execute the move
  board.value.move(move.from, move.to);

  await new Promise((resolve) => setTimeout(resolve, duration));
};

defineExpose<ChessBoardExpose>({
  updateConfig: (config: Config) => {
    if (board.value) {
      board.value.set(config);
    }
  },
  playAnimations: async (moves: AnimationMove[], duration: number = 400) => {
    console.log(`[ChessBoard] playAnimations called`);
    if (!board.value) return;
    if (animating.value) return;

    animating.value = true;
    const originalFen = props.position.fen;

    for (const move of moves) {
      console.log(`[ChessBoard] found move ${JSON.stringify(move)}`);
      await playAnimation(move, duration);
    }

    // Reset to original position
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        const animState = board.value?.state.animation;
        board.value?.set({
          animation: {
            enabled: false,
          },
        });
        board.value?.set({ fen: originalFen });
        board.value?.set({ animation: animState });
        animating.value = false;
        resolve();
      }, duration);
    });
  },

  showMoves: async (sm: ShowMoves) => {
    try {
      if (!board.value) {
        console.log('[ChessBoard] showMoves aborted: board.value is not defined');
        return;
      }
      if (animating.value) {
        console.log('[ChessBoard] showMoves aborted: animation is already in progress');
        return;
      }

      console.log(`[ChessBoard] showMoves started with parameters: ${JSON.stringify(sm)}`);
      animating.value = true;

      const originalFen = props.position.fen;
      const originalMovable = board.value.state.movable;

      if (sm.piece) {
        board.value.setPieces(new Map([[sm.square, ChessUtils.asCgPiece(sm.piece)]]));
      }

      const dests: Dests = new Map();
      dests.set(sm.square, sm.dests);

      board.value.set({
        movable: {
          ...originalMovable,
          dests,
          color: 'both',
          showDests: true,
        },
      });

      board.value.selectSquare(sm.square, true);

      await new Promise((resolve) => {
        const waitDuration = sm.duration || 3000;
        console.log(`[ChessBoard] waiting ${waitDuration}ms for move visualization`);
        setTimeout(resolve, waitDuration);
      });

      console.log(`[ChessBoard] unselecting square ${sm.square} and resetting board state`);
      board.value.selectSquare(null);
      board.value.set({ fen: originalFen });
      console.log(`[ChessBoard] board FEN reset to original: $fsle{originalFen}`);
      board.value.set({ movable: originalMovable });
      console.log('[ChessBoard] original movable settings restored');
    } finally {
      animating.value = false;
      console.log('[ChessBoard] animating flag set to false; showMoves concluded');
    }
  },
});

const props = defineProps<{
  position: ChessPosition;
  config?: Config;
  showCoordinates?: boolean;
  animations?: AnimationMove[];
}>();

const emit = defineEmits<{
  move: [move: Move];
  'position-change': [position: ChessPosition];
}>();

const boardElement = ref<HTMLElement>();
const board = ref<CgAPI>();
const animating = ref(false);

// Setup and cleanup
onMounted(() => {
  if (!boardElement.value) return;
  board.value = Chessground(boardElement.value, {
    ...props.config,
    fen: props.position.fen,

    orientation: props.position.orientation || 'cg-white',
    movable: {
      events: {
        after: (orig, dest) => {
          emit('move', { from: orig, to: dest });
        },
      },
      ...props.config?.movable,
    },
  });
});

onUnmounted(() => {
  board.value?.destroy();
});

// Watch for position changes
watch(
  () => props.position,
  (newPos) => {
    board.value?.set({ fen: newPos.fen });
  },
  { deep: true }
);
watch(
  () => props.config,
  (newConfig) => {
    console.log('[ChessBoard] Config changed:', newConfig);
    if (board.value && newConfig) {
      board.value.set(newConfig);
    }
  },
  { deep: true }
);
</script>

<style scoped>
.chess-board-container {
  position: relative;
  width: 100%;
}

.board-and-files {
  position: relative;
  width: 100%;
  /* Create a square aspect ratio */
  padding-bottom: 100%;
}

.board {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
