<template>
  <!-- Template remains largely the same -->
  <div data-viewable="PuzzleView">
    <p class="text-h5">
      Make the best move for {{ playerColor === 'cg-white' ? 'White ♖♘♗♕♔♗♘♖' : 'Black ♜♞♝♚♛♝♞♜' }}:
    </p>
    <div class="puzzle-board-wrapper">
      <div class="puzzle-ranks-labels">
        <div v-for="rank in 8" :key="rank">{{ playerColor === 'cg-white' ? 9 - rank : rank }}</div>
      </div>
      <div class="puzzle-board-and-files">
        <div id="cg" ref="boardElement"></div>
        <div class="puzzle-files-labels">
          <div v-for="file in files" :key="file">{{ file }}</div>
        </div>
      </div>
    </div>
    <div v-if="showPromotionDialog" class="puzzle-promotion-dialog">
      <button v-for="piece in promotionPieces" :key="piece.value" @click="handlePromotion(piece.value)">
        {{ playerColor === 'cg-white' ? piece.whiteSymbol : piece.blackSymbol }}
        {{ piece.name }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted, PropType } from 'vue';
import { Chessground } from '../../chessground/chessground';
import { Key } from '../../chessground/types';
import { Api as cgAPI } from '../../chessground/api';
import { useViewable, useQuestionView } from '@vue-skuilder/common-ui';
import { ChessPuzzle } from './index';
import { Chess, SQUARES } from 'chess.js';
import { ViewData } from '@/base-course/Interfaces/ViewData';

// Types and interfaces
type PromotionPiece = 'q' | 'r' | 'b' | 'n';
type Color = 'cg-white' | 'cg-black';

interface UciMove {
  from: string;
  to: string;
  promotion?: PromotionPiece;
}

// Helper functions (moved outside component)
const parseUciMove = (moveString: string): UciMove => {
  if (moveString.length < 4 || moveString.length > 5) {
    throw new Error(`Invalid UCI move format: ${moveString}`);
  }

  return {
    from: moveString.substring(0, 2),
    to: moveString.substring(2, 4),
    promotion: moveString.length === 5 ? (moveString[4] as PromotionPiece) : undefined,
  };
};

const toDests = (chess: Chess) => {
  const dests = new Map();
  SQUARES.forEach((s) => {
    const ms = chess.moves({ square: s, verbose: true });
    if (ms.length)
      dests.set(
        s,
        ms.map((m) => m.to)
      );
  });
  return dests;
};

const swapColor = (color: Color): Color => (color === 'cg-white' ? 'cg-black' : 'cg-white');

const toColor = (chess: Chess): Color => (chess.turn() === 'w' ? 'cg-white' : 'cg-black');

// Chess puzzle component
export default defineComponent({
  name: 'PuzzleView',

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
    // Initialize base utilities
    const viewableUtils = useViewable(props, emit, 'PuzzleView');
    const questionUtils = useQuestionView<ChessPuzzle>(viewableUtils);

    // State
    const boardElement = ref<HTMLElement | null>(null);
    const chessEngine = ref<Chess>();
    const chessBoard = ref<cgAPI>();
    const playerColor = ref<Color>('cg-white');
    const showPromotionDialog = ref(false);
    const promotionMove = ref<{ from: string; to: string } | null>(null);

    const ANIM_DELAY = 300;

    const promotionPieces = [
      { value: 'q', name: 'Queen', whiteSymbol: '♕', blackSymbol: '♛' },
      { value: 'r', name: 'Rook', whiteSymbol: '♖', blackSymbol: '♜' },
      { value: 'b', name: 'Bishop', whiteSymbol: '♗', blackSymbol: '♝' },
      { value: 'n', name: 'Knight', whiteSymbol: '♘', blackSymbol: '♞' },
    ];

    // Computed
    const files = computed(() => {
      const filesList = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      return playerColor.value === 'cg-white' ? filesList : filesList.reverse();
    });

    // Methods
    const isPromotionPiece = (p?: string): p is PromotionPiece => {
      if (!p) return false;
      return ['q', 'r', 'b', 'n'].includes(p);
    };

    const isUnfinishedPromotion = (from: string, to: string, promotionPiece?: PromotionPiece) => {
      if (isPromotionPiece(promotionPiece)) return false;
      // [ ] typing
      // @ts-expect-error - `from` is well-formed
      const piece = chessEngine.value?.get(from);
      return piece?.type === 'p' && (to[1] === '8' || to[1] === '1');
    };

    const updateChessground = () => {
      if (!chessEngine.value || !chessBoard.value) return;

      chessBoard.value.set({
        fen: chessEngine.value.fen(),
        turnColor: toColor(chessEngine.value),
        movable: {
          color: toColor(chessEngine.value),
          dests: toDests(chessEngine.value),
        },
      });
    };

    const handlePromotion = (promotionPiece: PromotionPiece) => {
      if (!promotionMove.value) return;

      viewableUtils.logger.log(`promoting to ${promotionPiece}`);
      showPromotionDialog.value = false;
      checkMove(promotionMove.value.from, promotionMove.value.to, promotionPiece);
    };

    const checkMove = (orig: string, dest: string, promotionPiece?: PromotionPiece) => {
      if (!questionUtils.question.value?.moves.length) {
        throw new Error('No moves');
      }

      if (isUnfinishedPromotion(orig, dest, promotionPiece)) {
        promotionMove.value = { from: orig, to: dest };
        showPromotionDialog.value = true;
        return;
      }

      const expectedMove = questionUtils.question.value.moves[0];
      const moveMade = isPromotionPiece(promotionPiece) ? `${orig}${dest}${promotionPiece}` : `${orig}${dest}`;

      if (expectedMove === moveMade) {
        chessEngine.value?.move({
          from: orig,
          to: dest,
          promotion: isPromotionPiece(promotionPiece) ? promotionPiece : undefined,
        });
        updateChessground();

        questionUtils.question.value.moves.shift();

        if (questionUtils.question.value.moves.length === 0) {
          questionUtils.submitAnswer('');
        } else {
          window.setTimeout(() => {
            if (!questionUtils.question.value) return;

            const nextMove = questionUtils.question.value.moves.shift()!;
            const move = parseUciMove(nextMove);
            chessEngine.value?.move(move);
            updateChessground();
          }, ANIM_DELAY);
        }
      } else {
        // Handle incorrect move
        chessEngine.value?.move({ from: orig, to: dest, promotion: promotionPiece });
        if (chessEngine.value?.isCheckmate()) {
          questionUtils.submitAnswer(ChessPuzzle.CHECKMATE);
        } else {
          chessEngine.value?.undo();
        }

        questionUtils.submitAnswer(orig + dest + promotionPiece);
        updateChessground();
      }
    };

    // Initialization
    onMounted(() => {
      if (!boardElement.value) return;

      questionUtils.question.value = new ChessPuzzle(props.data);
      chessEngine.value = new Chess(questionUtils.question.value.fen);
      playerColor.value = swapColor(toColor(chessEngine.value));

      chessBoard.value = Chessground(boardElement.value, {
        movable: {
          free: false,
          showDests: true,
          dests: toDests(chessEngine.value),
          events: {
            // [ ] typing
            // @ts-expect-error - `orig` and `dest` are well-formed
            after: checkMove,
          },
        },
        draggable: {
          showGhost: true,
        },
        fen: chessEngine.value.fen(),
        orientation: playerColor.value,
        coordinates: false,
        animation: {
          duration: ANIM_DELAY,
          enabled: true,
        },
      });

      // Make first move
      const firstMove = questionUtils.question.value.moves.shift()!;
      chessBoard.value.move(firstMove.substring(0, 2) as Key, firstMove.substring(2) as Key);
      chessEngine.value.move({
        from: firstMove.substring(0, 2),
        to: firstMove.substring(2),
      });
      updateChessground();
    });

    onUnmounted(() => {
      chessBoard.value?.destroy();
      chessEngine.value = undefined;
    });

    return {
      boardElement,
      playerColor,
      files,
      showPromotionDialog,
      promotionPieces,
      handlePromotion,
      ...viewableUtils,
      ...questionUtils,
    };
  },
});
</script>

<style>
@import '../../chessground/css/chessground.base.css';
@import '../../chessground/css/chessground.brown.css';
@import '../../chessground/css/chessground.cburnett.css';

.puzzle-promotion-dialog {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, 0.95);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.puzzle-promotion-dialog button {
  padding: 10px 20px;
  font-size: 16px;
  border: none;
  background: #f0f0f0;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 150px;
}

.puzzle-promotion-dialog button:hover {
  background: #e0e0e0;
}

/* Optional: Add piece symbols next to text */
.puzzle-promotion-dialog button::before {
  content: attr(data-piece);
  font-size: 24px;
}

.puzzle-board-wrapper {
  display: flex;
  align-items: center;
  width: 440px;
}

.puzzle-ranks-labels {
  display: flex;
  flex-direction: column;
  justify-content: center;
  /* width: 0px; */
  height: 400px;
  margin-right: 10px;
}

.puzzle-ranks-labels.reversed {
  flex-direction: column-reverse;
}

.puzzle-ranks-labels div {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.puzzle-board-and-files {
  display: flex;
  flex-direction: column;
}

.puzzle-files-labels {
  display: flex;
  justify-content: center;
  height: 20px;
}

.puzzle-files-labels.reversed {
  flex-direction: row-reverse;
}

.puzzle-files-labels div {
  width: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}

#cg {
  width: 400px;
  height: 400px;
}
</style>
