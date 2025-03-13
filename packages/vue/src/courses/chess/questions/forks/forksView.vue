<template>
  <div data-viewable="ForksView">
    <p class="text-h5">Find safe forking squares for the</p>
    <p class="text-h3">{{ pieceImg }}</p>

    <div class="forks-board-container">
      <ChessBoard :position="boardPosition" :config="boardConfig" ref="chessboard" />
    </div>

    <div v-if="findMore" class="text-h5">Find more forks!</div>

    <v-btn v-if="selectedSquares.length === 0" color="primary" @click="checkAnswer">No forks!</v-btn>
    <v-btn v-else color="primary" @click="checkAnswer">All done!</v-btn>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useViewable, useQuestionView } from '@/base-course/CompositionViewable';
import ChessBoard from '../../components/ChessBoard.vue';
import { ForkFinder } from './index';
import type { ChessPosition } from '../../components/types';
import type { ViewData } from '@vue-skuilder/common';
import ChessUtils from '../../chessUtils';
import { Config } from '../../chessground/config';
import { DrawShape } from '../../chessground/draw';
import checkmark from '../../assets/checkmark.svg?raw';
import xmark from '../../assets/x-mark.svg?raw';
import { Key } from '../../chessground/types';
import { Chess, Piece, Square } from 'chess.js';

console.log(`[forksView] checkmark: ${checkmark}`);

const wrapSvg = (svg: string) => `
  <g transform="translate(2 2) scale(0.3)">
    ${svg}
  </g>
`;

const chessboard = ref<InstanceType<typeof ChessBoard>>();

const props = defineProps<{
  data: ViewData[];
  modifyDifficulty?: number;
}>();

const emit = defineEmits<{
  (event: string, ...args: unknown[]): void;
}>();

const viewableUtils = useViewable(props, emit, 'ForksView');
const questionUtils = useQuestionView<ForkFinder>(viewableUtils);

const selectedSquares = ref<Key[]>([]);
const handlingClick = ref(false);

const findMore = ref(false);

// Initialize question
questionUtils.question.value = new ForkFinder(props.data);

const playerPiece = computed(() => {
  return questionUtils.question.value?.playerPiece();
});

const pieceImg = computed(() => {
  if (playerPiece.value) {
    return ChessUtils.cjsPieceToString(playerPiece.value);
  } else {
    return '';
  }
});

const currentPosition = computed(() => {
  return questionUtils.question.value?.getCurrentPosition();
});

const boardPosition = computed<ChessPosition>(() => {
  const fen = currentPosition.value?.fen || '8/8/8/8/8/8/8/8 w - - 0 1';
  console.log(`[forksView] Position: ${fen}`);
  const orientation = ChessUtils.toMove(fen);

  return {
    fen,
    orientation,
  };
});

const shapes = computed<DrawShape[]>(() => {
  return selectedSquares.value.map((ss) => ({
    orig: ss,
    customSvg: {
      html: currentPosition.value?.solutions.includes(ss) ? checkmark : wrapSvg(xmark),
    },
  }));
});

const boardConfig = computed<Config>(() => {
  return {
    viewOnly: false,
    movable: {
      free: true,
      color: 'both',
      showDests: true,
    },
    dropMode: {
      active: true,
      piece: playerPiece.value,
    },
    drawable: {
      enabled: true,
      shapes: shapes.value,
    },
    coordinates: false,
    events: {
      select: (square: Key) => handleSquareClick(square),
    },
    animation: {
      enabled: true,
      duration: 500,
    },
  };
});

const handleSquareClick = async (square: Key) => {
  console.log(`[forksView] clicked ${square}`);
  findMore.value = false;
  if (handlingClick.value) {
    console.log(`[forksView] handling click already in progress`);
    return;
  }

  if (selectedSquares.value?.includes(square)) {
    // don't reanimate or de-select
    console.log(`[forksView] square already selected`);

    nextTick(() => {
      chessboard.value?.updateConfig({
        drawable: {
          shapes: [...shapes.value],
          enabled: true,
        },
      });
    });

    return;
  }

  handlingClick.value = true;

  // [ ] communicate w/ quesetionType for correct/incorrect handling
  //

  if (!currentPosition.value) {
    console.warn(`[forksView] handling click w/ no currentPosition`);
    throw new Error(`[forksView] handling click w/ no currentPosition`);
  }

  // animate the responses:

  // square is correct?
  if (questionUtils.question.value?.getCurrentPosition().solutions.includes(square)) {
    // animate capturing both enemy pieces
    const chess = new Chess();
    chess.load(currentPosition.value?.fen, {
      skipValidation: true,
    });

    const enemyPieces: { p: Piece; s: Square }[] = [];
    chess.board().forEach((rank) => {
      if (rank) {
        rank.forEach((square) => {
          if (square && square.color !== playerPiece.value?.color) {
            enemyPieces.push({ p: square, s: square.square });
          }
        });
      }
    });

    await chessboard.value?.playAnimations(
      enemyPieces.map((p) => {
        return {
          from: square,
          to: p.s,
          movingPiece: playerPiece.value!,
        };
      })
    );
  } else {
    // square is incorrect.

    // animate getting captured by an enemy
    const chess = new Chess();
    console.log(currentPosition.value.fen);
    chess.load(currentPosition.value.fen, {
      skipValidation: true,
    });

    let pp: Piece;
    if (playerPiece.value) {
      pp = playerPiece.value;
    } else {
      console.warn(`[forksView] handling click w/ no playerPiece`);
      return;
    }

    const attackers = chess.attackers(square as Square, ChessUtils.oppositeCjsColor(pp.color));

    console.log(`[forksView] attackers: ${JSON.stringify(attackers)}`);

    if (attackers.length) {
      // incorrect because the square was not safe - animate getting captured by enemy(ies)
      await chessboard.value?.playAnimations(
        attackers.map((a) => {
          return {
            from: a,
            to: square,
            pieces: [[pp, square as Square]],
          };
        })
      );
    } else {
      // incorrect because the square does not attack both enemies.
      // highlight available moves

      console.log(`[forksView] no attackers found`);
      console.log(`[forksView] calculating destination moves for square: ${square}`);

      chess.put(pp, square as Square);

      const moves = chess.moves({
        square: square as Square,
        verbose: true,
      });
      console.log(`[forksView] available moves: ${JSON.stringify(moves)}`);

      const dests = moves.map((m) => m.to);

      console.log(`[forksView] final destination moves for square '${square}': ${JSON.stringify(dests)}`);

      await chessboard.value?.showMoves({
        square: square as Square,
        piece: ChessUtils.asCgPiece(pp),
        dests,
        duration: 2000,
      });
    }
  }

  // add the square to selections
  console.log(`[forksView] adding square ${square} to selectedSquares`);
  handlingClick.value = false;
  selectedSquares.value = [...selectedSquares.value, square];
};

const checkAnswer = () => {
  if (!currentPosition.value) {
    throw new Error(`[forksView] checkAnswer w/ no currentPosition`);
  }

  let complete = true;
  if (complete) {
    for (const soln of currentPosition.value.solutions) {
      if (!selectedSquares.value.includes(soln)) {
        complete = false;
        break;
      }
    }
  }
  if (complete) {
    console.log(`[forksView] complete!`);
  } else {
    console.log(`[forksView] incomplete!`);

    findMore.value = true;
  }
  questionUtils.submitAnswer(selectedSquares.value);
};

watch(
  () => shapes.value,
  (newShapes) => {
    console.log('shapes changed:', newShapes);
  }
);

watch(
  () => boardConfig.value,
  (newConfig) => {
    console.log('boardConfig changed:', newConfig);
  }
);
</script>

<style scoped>
.forks-board-container {
  width: 400px;
  margin: 20px auto;
}

.selected-squares {
  margin: 20px 0;
  font-size: 1.1em;
}
</style>
