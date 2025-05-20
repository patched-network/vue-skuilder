<template>
  <div class="card-preview-list">
    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteConfirm" max-width="400px">
      <v-card>
        <v-card-title class="text-h5">Remove Card</v-card-title>
        <v-card-text>
          <p>Are you sure you want to remove this card?</p>
          <v-checkbox
            v-model="dontAskAgain"
            label="Don't ask me again"
            hide-details
            class="mt-2"
          ></v-checkbox>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey-darken-1" variant="text" @click="cancelDelete">Cancel</v-btn>
          <v-btn color="error" @click="confirmDelete">Remove</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    
    <v-card v-if="parsedCards.length > 0" class="mb-4">
      <v-card-title class="d-flex align-center justify-space-between">
        <span>Card Preview</span>
        <div class="d-flex align-center">
          <div class="text-subtitle-1 mr-2">{{ currentIndex + 1 }} of {{ parsedCards.length }}</div>
          <sk-mouse-trap />
        </div>
      </v-card-title>

      <v-card-text>
        <div v-if="loading" class="d-flex justify-center align-center my-4">
          <v-progress-circular indeterminate color="primary"></v-progress-circular>
        </div>
        <div v-else>
          <div v-if="currentCard">
            <v-sheet class="card-content pa-4 mb-4" rounded border>
              <!-- Rendered card content -->
              <div v-if="viewComponents && viewComponents.length > 0">
                <card-browser :views="viewComponents" :data="[currentViewData]" :suppress-spinner="true" />
              </div>
              <!-- Fallback markdown display when no view components are available -->
              <div v-else>
                <div class="mb-2 font-weight-bold">Card content:</div>
                <div class="markdown-content">{{ currentCard.markdown }}</div>
              </div>
            </v-sheet>

            <div class="card-metadata mt-2">
              <div class="d-flex flex-wrap gap-1">
                <v-chip
                  v-for="tag in currentCard.tags"
                  :key="tag"
                  size="small"
                  color="primary"
                  variant="outlined"
                  class="mr-1 mb-1"
                >
                  {{ tag }}
                </v-chip>
              </div>
              <div v-if="currentCard.elo !== undefined" class="mt-2 text-caption">ELO: {{ currentCard.elo }}</div>
            </div>
          </div>
          <div v-else class="text-center pa-4">No card selected or available to preview.</div>
        </div>
      </v-card-text>

      <v-card-actions class="px-4 pb-4">
        <v-btn variant="outlined" icon :disabled="currentIndex === 0 || loading" @click="prevCard">
          <v-icon>mdi-chevron-left</v-icon>
        </v-btn>

        <v-spacer></v-spacer>

        <v-btn
          variant="tonal"
          color="error"
          prepend-icon="mdi-delete"
          class="mx-2"
          @click="promptDelete"
          :disabled="!currentCard || loading"
        >
          Remove
        </v-btn>

        <v-btn
          variant="tonal"
          color="primary"
          prepend-icon="mdi-pencil"
          class="mx-2"
          @click="editCurrentCard"
          :disabled="!currentCard || loading"
        >
          Edit
        </v-btn>

        <v-spacer></v-spacer>

        <v-btn variant="outlined" icon :disabled="currentIndex >= parsedCards.length - 1 || loading" @click="nextCard">
          <v-icon>mdi-chevron-right</v-icon>
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script lang="ts">
import { ViewComponent, SkldrMouseTrap, HotKey, SkMouseTrap } from '@vue-skuilder/common-ui';
import { DataShape, ParsedCard, ViewData } from '@vue-skuilder/common';
import { defineComponent, PropType } from 'vue';
import CardBrowser from '../CardBrowser.vue';

export default defineComponent({
  name: 'CardPreviewList',

  components: {
    CardBrowser,
    SkMouseTrap,
  },

  props: {
    parsedCards: {
      type: Array as PropType<ParsedCard[]>,
      required: true,
      default: () => [],
    },
    dataShape: {
      type: Object as PropType<DataShape>,
      required: true,
    },
    viewComponents: {
      type: Array as PropType<ViewComponent[]>,
      required: false,
      default: () => [],
    },
  },

  emits: ['update:parsedCards', 'edit-card', 'delete-card'],

  data() {
    return {
      currentIndex: 0,
      loading: false,
      keyBindings: [] as HotKey[],
      showDeleteConfirm: false,
      dontAskAgain: false,
      skipDeleteConfirmation: false,
      shortcutsEnabled: true,
    };
  },

  computed: {
    currentCard(): ParsedCard | null {
      if (this.parsedCards.length === 0 || this.currentIndex >= this.parsedCards.length) {
        return null;
      }
      return this.parsedCards[this.currentIndex];
    },

    currentViewData(): ViewData {
      if (!this.currentCard) {
        return { Input: '' };
      }

      // Convert ParsedCard to ViewData
      return {
        Input: this.currentCard.markdown,
        // Any additional fields the view might need
      };
    },
  },

  methods: {
    nextCard() {
      if (this.currentIndex < this.parsedCards.length - 1) {
        this.currentIndex++;
      }
    },

    prevCard() {
      if (this.currentIndex > 0) {
        this.currentIndex--;
      }
    },

    showCard(index: number) {
      if (index >= 0 && index < this.parsedCards.length) {
        this.currentIndex = index;
      }
    },

    setupKeyBindings() {
      // Define key bindings for navigation
      this.keyBindings = [
        {
          command: 'Previous Card',
          hotkey: 'left',
          callback: () => {
            this.prevCard();
            return false; // Prevent default
          },
        },
        {
          command: 'Next Card',
          hotkey: 'right',
          callback: () => {
            this.nextCard();
            return false; // Prevent default
          },
        },
        {
          command: 'Delete Card',
          hotkey: 'del',
          callback: () => {
            this.promptDelete();
            return false; // Prevent default
          },
        },
        {
          command: 'Edit Card',
          hotkey: 'e',
          callback: () => {
            this.editCurrentCard();
            return false; // Prevent default
          },
        },
      ];

      if (this.shortcutsEnabled) {
        // Register keyboard shortcuts
        SkldrMouseTrap.bind(this.keyBindings);
      }
    },
    
    enableShortcuts() {
      if (!this.shortcutsEnabled) {
        this.shortcutsEnabled = true;
        SkldrMouseTrap.bind(this.keyBindings);
        console.log('[CardPreviewList] Keyboard shortcuts enabled');
      }
    },

    disableShortcuts() {
      if (this.shortcutsEnabled) {
        this.shortcutsEnabled = false;
        SkldrMouseTrap.reset();
        console.log('[CardPreviewList] Keyboard shortcuts disabled');
      }
    },
    
    toggleShortcuts(enable: boolean) {
      if (enable) {
        this.enableShortcuts();
      } else {
        this.disableShortcuts();
      }
    },

    promptDelete() {
      if (!this.currentCard) return;
      
      if (this.skipDeleteConfirmation) {
        this.deleteCurrentCard();
      } else {
        this.showDeleteConfirm = true;
      }
    },
    
    cancelDelete() {
      this.showDeleteConfirm = false;
    },
    
    confirmDelete() {
      if (this.dontAskAgain) {
        this.skipDeleteConfirmation = true;
      }
      
      this.showDeleteConfirm = false;
      this.deleteCurrentCard();
    },
    
    deleteCurrentCard() {
      if (!this.currentCard) return;

      // Create a new array without the current card
      const updatedCards = [...this.parsedCards];
      updatedCards.splice(this.currentIndex, 1);

      // Emit event with updated array
      this.$emit('update:parsedCards', updatedCards);

      // Also emit a specific event for parent component to handle
      this.$emit('delete-card', this.currentIndex);

      // Adjust current index if needed
      if (this.currentIndex >= updatedCards.length && updatedCards.length > 0) {
        this.currentIndex = updatedCards.length - 1;
      }
    },

    editCurrentCard() {
      if (!this.currentCard) return;

      // Emit event with current card and index
      this.$emit('edit-card', this.currentCard, this.currentIndex);
    },
  },
  mounted() {
    this.setupKeyBindings();
  },
  
  beforeUnmount() {
    // Clean up key bindings when component is unmounted
    SkldrMouseTrap.reset();
  },
});
</script>

<style scoped>
.card-preview-list {
  width: 100%;
}

.card-content {
  min-height: 150px;
  background-color: #f8f9fa;
}

.markdown-content {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
  font-family: var(--v-font-family);
}

.gap-1 {
  gap: 4px;
}
</style>
