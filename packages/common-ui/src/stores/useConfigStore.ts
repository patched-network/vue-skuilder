// stores/useConfigStore.ts
import { defineStore, setActivePinia } from 'pinia';
import { getCurrentUser } from './useAuthStore';
import { UserConfig } from '@vue-skuilder/db';
import { getPinia } from '../plugins/pinia';

export const useConfigStore = () => {
  // Get the Pinia instance from the plugin
  const pinia = getPinia();
  if (pinia) {
    setActivePinia(pinia);
  }

  // Return the store
  return defineStore('config', {
    state: () => ({
      config: {
        darkMode: false,
        likesConfetti: false,
        sessionTimeLimit: 5, // Default 5 minutes
      } as UserConfig,
    }),

    actions: {
      updateConfig(newConfig: UserConfig) {
        this.config = newConfig;
      },
      async updateDarkMode(darkMode: boolean) {
        this.config.darkMode = darkMode;
        const user = await getCurrentUser();
        await user.setConfig({
          darkMode,
        });
      },

      async updateLikesConfetti(likesConfetti: boolean) {
        this.config.likesConfetti = likesConfetti;
        const user = await getCurrentUser();
        await user.setConfig({
          likesConfetti,
        });
      },

      async updateSessionTimeLimit(sessionTimeLimit: number) {
        this.config.sessionTimeLimit = sessionTimeLimit;
        const user = await getCurrentUser();
        await user.setConfig({
          sessionTimeLimit,
        });
      },

      async hydrate() {
        const user = await getCurrentUser();
        const cfg = await user.getConfig();
        console.log(`user config: ${JSON.stringify(cfg)}`);
        this.updateConfig(cfg);
      },
      async init() {
        await this.hydrate();
      },
      resetDefaults() {
        this.config = {
          darkMode: false,
          likesConfetti: false,
          sessionTimeLimit: 5,
        };
      },
    },
  })();
};
