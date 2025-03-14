import { defineStore } from 'pinia';

export interface PreviewModeState {
  previewMode: boolean;
}

export const useCardPreviewModeStore = defineStore('previewMode', {
  state: (): PreviewModeState => ({
    previewMode: false,
  }),

  actions: {
    setPreviewMode(mode: boolean) {
      this.previewMode = mode;
    },
  },

  getters: {
    isPreviewMode(): boolean {
      return this.previewMode;
    },
  },
});
