<!-- src/courses/chess/components/base/PromotionDialog.vue -->
<template>
  <div class="chess-promotion-dialog">
    <button
      v-for="piece in promotionPieces"
      :key="piece.value"
      class="promotion-piece-button"
      @click="() => emit('select', piece.value)"
    >
      <span class="piece-symbol">
        {{ color === 'cg-white' ? piece.symbol.white : piece.symbol.black }}
      </span>
      <span class="piece-name">{{ piece.name }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { promotionPieces } from '../composables/usePromotionDialog';

defineProps<{
  color: 'cg-white' | 'cg-black';
}>();

const emit = defineEmits<{
  select: [piece: 'q' | 'r' | 'b' | 'n'];
}>();
</script>

<style scoped>
.chess-promotion-dialog {
  position: fixed;
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

.promotion-piece-button {
  padding: 10px 20px;
  font-size: 16px;
  border: none;
  background: #f0f0f0;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 150px;
  transition: background-color 0.2s;
}

.promotion-piece-button:hover {
  background: #e0e0e0;
}

.piece-symbol {
  font-size: 24px;
}

.piece-name {
  font-size: 16px;
}
</style>
