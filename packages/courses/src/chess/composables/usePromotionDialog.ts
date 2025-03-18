// src/courses/chess/composables/usePromotionDialog.ts
import { ref } from 'vue';
import type { Move } from '../components/types';

export const promotionPieces = [
  { value: 'q' as const, name: 'Queen', symbol: { white: '♕', black: '♛' } },
  { value: 'r' as const, name: 'Rook', symbol: { white: '♖', black: '♜' } },
  { value: 'b' as const, name: 'Bishop', symbol: { white: '♗', black: '♝' } },
  { value: 'n' as const, name: 'Knight', symbol: { white: '♘', black: '♞' } },
] as const;

export type PromotionPiece = (typeof promotionPieces)[number]['value'];

export function usePromotionDialog() {
  const showDialog = ref(false);
  const pendingMove = ref<Omit<Move, 'promotion'>>();

  const openPromotionDialog = (move: Omit<Move, 'promotion'>) => {
    pendingMove.value = move;
    showDialog.value = true;
  };

  const closeDialog = () => {
    showDialog.value = false;
    pendingMove.value = undefined;
  };

  return {
    showDialog,
    pendingMove,
    openPromotionDialog,
    closeDialog,
  };
}
