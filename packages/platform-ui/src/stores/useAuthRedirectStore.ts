import { defineStore } from 'pinia';

export interface AuthRedirectContext {
  path: string;
  reason: 'admin-required' | 'auth-required' | 'auth-failed';
  timestamp: number;
}

export const useAuthRedirectStore = defineStore('authRedirect', {
  state: () => ({
    pendingRedirect: null as AuthRedirectContext | null,
  }),

  getters: {
    hasPendingRedirect: (state) => {
      if (!state.pendingRedirect) return false;
      
      // Check if redirect is stale (older than 10 minutes)
      const now = Date.now();
      const age = now - state.pendingRedirect.timestamp;
      const maxAge = 10 * 60 * 1000; // 10 minutes
      
      if (age > maxAge) {
        // Clear stale redirect
        return false;
      }
      
      return true;
    },

    redirectPath: (state) => state.pendingRedirect?.path || '/',
    
    redirectReason: (state) => state.pendingRedirect?.reason || null,
    
    contextualMessage: (state) => {
      if (!state.pendingRedirect) return null;
      
      switch (state.pendingRedirect.reason) {
        case 'admin-required':
          return 'Admin access required for this page. Please log in with an admin account.';
        case 'auth-required':
          return 'Please log in to access this page.';
        case 'auth-failed':
          return 'Authentication error occurred. Please try logging in again.';
        default:
          return 'Please log in to continue.';
      }
    },

    alertType: (state) => {
      if (!state.pendingRedirect) return 'info';
      
      switch (state.pendingRedirect.reason) {
        case 'admin-required':
          return 'warning' as const;
        case 'auth-required':
          return 'info' as const;
        case 'auth-failed':
          return 'error' as const;
        default:
          return 'info' as const;
      }
    },
  },

  actions: {
    setPendingRedirect(path: string, reason: AuthRedirectContext['reason']) {
      this.pendingRedirect = {
        path,
        reason,
        timestamp: Date.now(),
      };
    },

    clearRedirect() {
      this.pendingRedirect = null;
    },

    // Get redirect context from either history state or store
    getRedirectContext(): AuthRedirectContext | null {
      // This will be called from components that have access to router
      return this.hasPendingRedirect ? this.pendingRedirect : null;
    },
  },
});