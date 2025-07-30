<template>
  <v-container class="d-flex align-center login">
    <!-- Show contextual message based on redirect reason -->
    <v-alert 
      v-if="redirectReason && !isUserLoggedIn" 
      :type="alertType"
      class="mb-4 w-100"
      :text="redirectMessage"
    ></v-alert>
    
    <user-login v-if="!isUserLoggedIn" :redirect-to="redirectPath" @login-success="onLoginSuccess" />
    <v-card v-else class="w-100 pa-4">
      <v-card-title class="text-center"> Already logged in! </v-card-title>
      <v-card-text class="text-center">
        You are currently logged in as <strong>{{ username }}</strong
        >.
      </v-card-text>
      <v-card-actions class="justify-center">
        <v-btn color="primary" @click="logout">
          <v-icon start>mdi-logout</v-icon>
          Log out
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { UserLogin, getCurrentUser, useAuthStore, useConfigStore } from '@vue-skuilder/common-ui';
import { useAuthRedirectStore, type AuthRedirectContext } from '../stores/useAuthRedirectStore';

export default defineComponent({
  name: 'LoginRoute',

  components: {
    UserLogin,
  },

  data() {
    return {
      username: '',
      authStore: useAuthStore(),
      configStore: useConfigStore(),
      redirectStore: useAuthRedirectStore(),
    };
  },

  computed: {
    isUserLoggedIn(): boolean {
      return this.authStore.isLoggedIn;
    },
    
    redirectContext(): AuthRedirectContext | null {
      // Try history state first (primary method)
      const historyState = this.$route.meta.state || (history.state as Record<string, unknown>);
      if (historyState?.redirect && historyState?.reason) {
        // Check if state is fresh (not stale)
        const age = Date.now() - (historyState.timestamp || 0);
        const maxAge = 10 * 60 * 1000; // 10 minutes
        if (age < maxAge) {
          return {
            path: historyState.redirect,
            reason: historyState.reason,
            timestamp: historyState.timestamp
          };
        }
      }
      
      // Fallback to store
      return this.redirectStore.getRedirectContext();
    },
    
    redirectReason(): string | null {
      return this.redirectContext?.reason || null;
    },
    
    redirectPath(): string {
      return this.redirectContext?.path || '/';
    },
    
    alertType(): 'error' | 'warning' | 'info' {
      return this.redirectStore.alertType;
    },
    
    redirectMessage(): string {
      return this.redirectStore.contextualMessage || 'Please log in to continue.';
    },
  },

  created() {
    if (this.isUserLoggedIn) {
      getCurrentUser().then((u) => {
        this.username = u.getUsername();
      });
    }
  },

  beforeUnmount() {
    // Clear redirect context when leaving login page after successful login
    if (this.isUserLoggedIn) {
      this.redirectStore.clearRedirect();
    }
  },

  methods: {
    async logout() {
      const res = await this.authStore._user!.logout();
      if (res.ok) {
        this.authStore.loginAndRegistration = {
          init: true,
          loggedIn: false,
          regDialogOpen: false,
          loginDialogOpen: false,
        };

        this.configStore.resetDefaults();
      }
    },

    onLoginSuccess() {
      // Clear redirect context after successful login
      this.redirectStore.clearRedirect();
    },
  },
});
</script>

<style lang="css" scoped>
.login {
  max-width: 650px;
}
</style>
