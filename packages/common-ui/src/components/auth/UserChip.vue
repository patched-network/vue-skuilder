<template>
  <v-badge :content="items.length" :model-value="hasNewItems" color="accent" location="end top">
    <v-menu location="bottom end" transition="scale-transition">
      <template #activator="{ props }">
        <v-chip v-bind="props" class="ma-2">
          <v-avatar start class="bg-primary">
            <v-icon>mdi-school</v-icon>
          </v-avatar>
          {{ username }}
        </v-chip>
      </template>

      <v-list>
        <v-list-item v-for="item in items" :key="item" @click="dismiss(item)">
          <v-list-item-title>{{ item }}</v-list-item-title>
        </v-list-item>

        <v-divider v-if="items.length" />

        <v-list-item @click="gotoStats">
          <template #prepend>
            <v-icon>mdi-trending-up</v-icon>
          </template>
          <v-list-item-title>Stats</v-list-item-title>
        </v-list-item>

        <v-list-item @click="gotoSettings">
          <template #prepend>
            <v-icon>mdi-cog</v-icon>
          </template>
          <v-list-item-title>Settings</v-list-item-title>
        </v-list-item>

        <v-list-item v-if="authUIConfig.showLogout" @click="logout">
          <template #prepend>
            <v-icon>mdi-logout</v-icon>
          </template>
          <v-list-item-title>{{ authUIConfig.logoutLabel }}</v-list-item-title>
        </v-list-item>

        <v-list-item v-if="authUIConfig.showResetData" @click="showResetDialog = true">
          <template #prepend>
            <v-icon>mdi-delete-sweep</v-icon>
          </template>
          <v-list-item-title>{{ authUIConfig.resetLabel }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </v-badge>

  <!-- Reset Confirmation Dialog -->
  <v-dialog v-model="showResetDialog" max-width="500px" persistent>
    <v-card>
      <v-card-title class="text-h5 d-flex align-center">
        <v-icon color="warning" class="mr-3">mdi-alert-circle</v-icon>
        Reset All User Data
      </v-card-title>
      
      <v-card-text>
        <p class="mb-4">This will permanently delete:</p>
        <ul class="mb-4">
          <li>All course progress and history</li>
          <li>Scheduled card reviews</li>
          <li>Course registrations</li>
          <li>User preferences</li>
        </ul>
        <p class="mb-4 text-error font-weight-bold">This cannot be undone.</p>
        
        <v-text-field
          v-model="confirmationText"
          label='Type "reset" to confirm'
          outlined
          dense
          @keyup.enter="isConfirmationValid && executeReset()"
        />
      </v-card-text>
      
      <v-card-actions>
        <v-spacer />
        <v-btn text @click="resetDialogState">Cancel</v-btn>
        <v-btn 
          color="error" 
          :disabled="!isConfirmationValid"
          @click="executeReset"
        >
          Reset All Data
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getCurrentUser, useAuthStore } from '../../stores/useAuthStore';
import { useConfigStore } from '../../stores/useConfigStore';
import { useAuthUI } from '../../composables/useAuthUI';

// Define props (even if not used, prevents warnings)
defineProps<{
  showLoginButton?: boolean;
  redirectToPath?: string;
}>();

const router = useRouter();
const authStore = useAuthStore();
const configStore = useConfigStore();
const authUI = useAuthUI();

const username = ref('');
const items = ref<string[]>([]);

// Reset confirmation dialog state
const showResetDialog = ref(false);
const confirmationText = ref('');

const isConfirmationValid = computed(() => confirmationText.value === 'reset');

const resetDialogState = () => {
  confirmationText.value = '';
  showResetDialog.value = false;
};

const hasNewItems = computed(() => items.value.length > 0);

const authUIConfig = computed(() => {
  const configValue = authUI.config.value;
  const fallback = {
    showLoginRegistration: true,
    showLogout: true,
    showResetData: false,
    logoutLabel: 'Log out',
    resetLabel: '',
  };
  
  return configValue || fallback;
});

onMounted(async () => {
  const user = await getCurrentUser();
  username.value = user.getUsername();
  
  // Detect sync strategy for conditional UI
  await authUI.detectSyncStrategy();
});

const gotoSettings = async () => {
  router.push(`/u/${(await getCurrentUser()).getUsername()}`);
};

const gotoStats = async () => {
  router.push(`/u/${(await getCurrentUser()).getUsername()}/stats`);
};

const dismiss = (item: string) => {
  const index = items.value.indexOf(item);
  items.value.splice(index, 1);
};

const logout = async () => {
  const res = await authStore._user!.logout();
  if (res.ok) {
    authStore.loginAndRegistration = {
      init: true,
      loggedIn: false,
      regDialogOpen: false,
      loginDialogOpen: false,
    };

    configStore.resetDefaults();
    router.push('/home');
  }
};

const executeReset = async () => {
  try {
    await authStore.resetUserData();
    configStore.resetDefaults();
    
    // Close dialog and navigate to home
    resetDialogState();
    router.push('/home');
  } catch (error) {
    console.error('Failed to reset user data:', error);
    // Could add a snackbar notification here
  }
};
</script>

<style scoped>
.component-fade-enter-active,
.component-fade-leave-active {
  transition: opacity 0.5s ease;
}
.component-fade-enter,
.component-fade-leave-to {
  opacity: 0;
}
</style>