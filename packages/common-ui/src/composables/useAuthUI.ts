import { ref, computed } from 'vue';
import { getCurrentUser } from '../stores/useAuthStore';

export interface AuthUIConfig {
  showLoginRegistration: boolean;
  showLogout: boolean;
  showResetData: boolean;
  logoutLabel: string;
  resetLabel: string;
}

export function useAuthUI() {
  const isLoading = ref(true);
  const syncStrategyDetected = ref(false);
  const isLocalOnlyMode = ref(false);

  const config = computed<AuthUIConfig>(() => {
    if (isLocalOnlyMode.value) {
      return {
        showLoginRegistration: false,
        showLogout: false,
        showResetData: true,
        logoutLabel: '',
        resetLabel: 'Reset User Data',
      };
    } else {
      return {
        showLoginRegistration: true,
        showLogout: true,
        showResetData: false,
        logoutLabel: 'Log out',
        resetLabel: '',
      };
    }
  });

  const detectSyncStrategy = async () => {
    try {
      isLoading.value = true;
      const user = await getCurrentUser();
      
      // Access the sync strategy through the user's private syncStrategy property
      // NoOpSyncStrategy (local-only) returns false for canCreateAccount
      // CouchDBSyncStrategy (remote sync) returns true for canCreateAccount
      const userInternal = user as any; // Type assertion to access private members
      const canCreateAccount = userInternal.syncStrategy?.canCreateAccount?.();
      
      isLocalOnlyMode.value = !canCreateAccount;
      syncStrategyDetected.value = true;
    } catch (error) {
      console.error('Failed to detect sync strategy:', error);
      // Default to remote sync mode on error
      isLocalOnlyMode.value = false;
      syncStrategyDetected.value = true;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    config,
    isLoading,
    syncStrategyDetected,
    isLocalOnlyMode,
    detectSyncStrategy,
  };
}