// common-ui/src/stores/useCardPreviewModeStore.ts
import { defineStore, setActivePinia } from 'pinia';
import { getPinia } from '../plugins/pinia';

export interface PreviewModeState {
  previewMode: boolean;
}

export const useCardPreviewModeStore = () => {
  // Get the Pinia instance from the plugin
  const pinia = getPinia();
  if (pinia) {
    setActivePinia(pinia);
  }

  // Return the store
  return defineStore('previewMode', {
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
  })();
};
