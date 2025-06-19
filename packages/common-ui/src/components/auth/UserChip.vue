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

        <v-list-item v-if="authUIConfig.showResetData" @click="resetUserData">
          <template #prepend>
            <v-icon>mdi-delete-sweep</v-icon>
          </template>
          <v-list-item-title>{{ authUIConfig.resetLabel }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </v-badge>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getCurrentUser, useAuthStore } from '../../stores/useAuthStore';
import { useConfigStore } from '../../stores/useConfigStore';
import { useAuthUI } from '../../composables/useAuthUI';

const router = useRouter();
const authStore = useAuthStore();
const configStore = useConfigStore();
const authUI = useAuthUI();

const username = ref('');
const items = ref<string[]>([]);

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
  
  const result = configValue || fallback;
  
  console.log('UserChip authUIConfig computed:', {
    configValue,
    fallback,
    result,
    isLocalOnlyMode: authUI.isLocalOnlyMode.value,
    syncStrategyDetected: authUI.syncStrategyDetected.value
  });
  
  return result;
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

const resetUserData = async () => {
  try {
    await authStore.resetUserData();
    configStore.resetDefaults();
    
    // Navigate to home to refresh the app state
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