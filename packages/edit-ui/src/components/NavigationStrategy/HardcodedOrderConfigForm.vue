<template>
  <div class="hardcoded-order-config-form">
    <v-textarea
      :model-value="cardIdsText"
      @update:model-value="updateCardIds"
      label="Card IDs"
      placeholder="Enter card IDs, one per line or separated by commas"
      rows="10"
      hint="Paste card IDs in the order they should be presented"
      persistent-hint
      required
    ></v-textarea>

    <v-alert v-if="cardCount > 0" type="info" density="compact" class="mt-2">
      {{ cardCount }} card{{ cardCount === 1 ? '' : 's' }} configured
    </v-alert>

    <v-alert v-if="validationError" type="error" density="compact" class="mt-2">
      {{ validationError }}
    </v-alert>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ref, watch } from 'vue';

/**
 * Configuration for hardcoded order strategy
 * Serialized format: JSON array of card IDs
 */
export interface HardcodedOrderConfig {
  cardIds: string[];
}

export default defineComponent({
  name: 'HardcodedOrderConfigForm',

  props: {
    modelValue: {
      type: Object as () => HardcodedOrderConfig,
      required: true,
    },
  },

  emits: ['update:modelValue'],

  setup(props, { emit }) {
    const validationError = ref<string | null>(null);

    // Convert card IDs array to text representation
    const cardIdsText = computed(() => {
      return props.modelValue.cardIds.join('\n');
    });

    // Count of configured cards
    const cardCount = computed(() => {
      return props.modelValue.cardIds.length;
    });

    /**
     * Update card IDs from text input
     * Splits on newlines or commas, trims, and filters empty strings
     */
    function updateCardIds(text: string) {
      validationError.value = null;

      try {
        const cardIdArray = text
          .split(/[\n,]+/)
          .map((id) => id.trim())
          .filter((id) => id);

        emit('update:modelValue', {
          cardIds: cardIdArray,
        });
      } catch (error) {
        validationError.value = error instanceof Error ? error.message : 'Invalid input';
      }
    }

    // Validate on mount and when config changes
    watch(
      () => props.modelValue,
      () => {
        if (props.modelValue.cardIds.length === 0) {
          validationError.value = 'At least one card ID is required';
        } else {
          validationError.value = null;
        }
      },
      { immediate: true }
    );

    return {
      cardIdsText,
      cardCount,
      validationError,
      updateCardIds,
    };
  },
});
</script>

<style scoped>
.hardcoded-order-config-form {
  padding: 16px 0;
}
</style>
