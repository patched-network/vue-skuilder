// stores/useAuthStore.ts
import { defineStore } from 'pinia';
import { User, GuestUsername } from '@vue-skuilder/db';
import { ENV } from '@vue-skuilder/common';

export interface AuthState {
  _user?: User;
  loginAndRegistration: {
    init: boolean;
    loggedIn: boolean;
    regDialogOpen: boolean;
    loginDialogOpen: boolean;
  };
  onLoadComplete: boolean;
}

export async function getCurrentUser(): Promise<User> {
  const store = useAuthStore();

  if (store._user) {
    return store._user as User;
  }

  // Wait for initialization if it's in progress
  if (!store.onLoadComplete) {
    // 200 * 50ms = 10 seconds
    let retries = 200;
    const timeout = 50;
    while (!store.onLoadComplete && retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, timeout));
      retries--;
      if (store._user) {
        return store._user;
      }
    }
    if (!store._user) {
      throw new Error('User initialization timed out');
    }
  }

  // If we get here and still no user, something's wrong
  if (!store._user) {
    throw new Error('User not initialized and store load complete - invalid state');
  }

  return store._user;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    _user: undefined as User | undefined,
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
      const authXML = new XMLHttpRequest();
      authXML.withCredentials = true;

      authXML.onerror = (e) => {
        console.error('init XHR Error:', e);
      };

      authXML.onreadystatechange = () => {
        console.log(`init ReadyState: ${authXML.readyState}, Status: ${authXML.status}`);
      };

      authXML.addEventListener('load', async () => {
        console.log(`init listener running`);
        try {
          const resp: {
            info: unknown;
            ok: boolean;
            userCtx: {
              name: string;
              roles: string[];
            };
          } = JSON.parse(authXML.responseText);
          console.log(`init resp: ${JSON.stringify(resp)}`);

          if (resp.userCtx.name && resp.userCtx.name !== '') {
            this._user = await User.instance(resp.userCtx.name);
            this.loginAndRegistration.loggedIn = true;
          } else {
            this._user = await User.instance(GuestUsername);
            this.loginAndRegistration.loggedIn = false;
          }

          console.log('init ONLOAD COMPLETE');
          this.onLoadComplete = true;
          this.loginAndRegistration.init = true;
        } catch (e) {
          console.log(`init error`);
          console.error(`init error:`, e);
        }
      });

      console.log(`init open running`);
      const url = `${ENV.COUCHDB_SERVER_PROTOCOL}://${ENV.COUCHDB_SERVER_URL}_session`;
      console.log(`Attempting to connect to: ${url}`);
      authXML.open('GET', url);
      console.log(`init send running`);
      authXML.send();
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
        user: state._user ? state._user.username : 'Guest',
      };
    },
  },
});
