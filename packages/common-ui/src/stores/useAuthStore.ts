// stores/useAuthStore.ts
import { defineStore } from 'pinia';
import { getDataLayer, UserDBInterface } from '@vue-skuilder/db';

export interface AuthState {
  _user: UserDBInterface | undefined;
  loginAndRegistration: {
    init: boolean;
    loggedIn: boolean;
    regDialogOpen: boolean;
    loginDialogOpen: boolean;
  };
  onLoadComplete: boolean;
}

export async function getCurrentUser(): Promise<UserDBInterface> {
  const store = useAuthStore();

  if (!store.onLoadComplete) {
    // Wait for initialization
    let retries = 200;
    const timeout = 50;
    while (!store.onLoadComplete && retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, timeout));
      retries--;
    }
    if (!store.onLoadComplete) {
      throw new Error('User initialization timed out');
    }
  }

  return getDataLayer().getUserDB();
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    _user: undefined as UserDBInterface | undefined,
    loginAndRegistration: {
      init: false,
      loggedIn: false,
      regDialogOpen: false,
      loginDialogOpen: false,
    },
    onLoadComplete: false,
  }),

  actions: {
    async init() {
      try {
        this._user = getDataLayer().getUserDB();

        this.loginAndRegistration.loggedIn = this._user.isLoggedIn();

        this.onLoadComplete = true;
        this.loginAndRegistration.init = true;
      } catch (e) {
        console.error('Failed to initialize auth store:', e);
      }
    },

    setLoginDialog(open: boolean) {
      this.loginAndRegistration.loginDialogOpen = open;
    },

    setRegDialog(open: boolean) {
      this.loginAndRegistration.regDialogOpen = open;
    },
  },

  getters: {
    currentUser: async () => getCurrentUser(),
    isLoggedIn: (state) => state.loginAndRegistration.loggedIn,
    isInitialized: (state) => state.loginAndRegistration.init,
    status: (state) => {
      return {
        loggedIn: state.loginAndRegistration.loggedIn,
        init: state.loginAndRegistration.init,
        user: state._user,
      };
    },
  },
});
