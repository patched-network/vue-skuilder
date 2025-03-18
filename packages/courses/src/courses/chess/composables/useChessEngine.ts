// src/courses/chess/composables/useChessEngine.ts
import { ref, computed } from 'vue';
import { Chess } from 'chess.js';
import type { Move } from '../components/types';

export function useChessEngine(initialFen?: string) {
  const engine = ref(new Chess(initialFen));

  const isGameOver = computed(() => {
    return engine.value.isGameOver();
  });

  const legalMoves = computed(() => {
    const dests = new Map();
    const moves = engine.value.moves({ verbose: true });
    moves.forEach((move) => {
      if (!dests.has(move.from)) {
        dests.set(move.from, []);
      }
      dests.get(move.from).push(move.to);
    });
    return dests;
  });

  const makeMove = (move: Move) => {
    return engine.value.move(move);
  };

  const validateMove = (move: Move) => {
    try {
      const possibleMoves = engine.value.moves({ verbose: true });
      return possibleMoves.some(
        (m) =>
          m.from === move.from &&
          m.to === move.to &&
          (!move.promotion || m.promotion === move.promotion)
      );
    } catch {
      return false;
    }
  };

  return {
    engine,
    isGameOver,
    legalMoves,
    makeMove,
    validateMove,
    currentFen: computed(() => engine.value.fen()),
  };
}
