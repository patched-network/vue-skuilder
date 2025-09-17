<template>
  <div v-if="userReady && display">
    <transition name="component-fade" mode="out-in">
      <div v-if="guestMode" key="login-buttons">
        <!-- Registration button: only if showLoginRegistration is true -->
        <v-dialog v-model="regDialog" width="500px" v-if="authUIConfig.showLoginRegistration">
          <template #activator="{ props }">
            <v-btn class="mr-2" size="small" color="success" v-bind="props">Sign Up</v-btn>
          </template>
          <UserRegistration @toggle="toggle" />
        </v-dialog>
        
        <!-- Login button: always show in guest mode -->
        <v-dialog v-model="loginDialog" width="500px">
          <template #activator="{ props }">
            <v-btn size="small" color="success" v-bind="props">Log In</v-btn>
          </template>
          <UserLogin @toggle="toggle" />
        </v-dialog>
      </div>
      <div v-else key="user-chip">
        <user-chip />
      </div>
    </transition>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import UserLogin from './UserLogin.vue';
import UserRegistration from './UserRegistration.vue';
import UserChip from './UserChip.vue';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAuthUI } from '../../composables/useAuthUI';
import { GuestUsername } from '@vue-skuilder/db';

// Define props
const props = defineProps<{
  showLoginButton?: boolean;
  redirectToPath?: string;
  showRegistration?: boolean;
}>();

const route = useRoute();
const authStore = useAuthStore();
const authUI = useAuthUI();

// Initialize auth UI detection
onMounted(async () => {
  await authUI.detectSyncStrategy();
});

const display = computed(() => {
  if (!route.name || typeof route.name !== 'string') {
    return true;
  }
  const routeName = route.name.toLowerCase();
  return !(routeName === 'login' || routeName === 'signup');
});

const userReady = computed(() => authStore.onLoadComplete);

const guestMode = computed(() => {
  if (authStore._user) {
    return authStore._user.getUsername().startsWith(GuestUsername);
  }
  return !authStore.loginAndRegistration.loggedIn;
});

const authUIConfig = computed(() => {
  const baseConfig = authUI.config.value || {
    showLoginRegistration: true,
    showLogout: true, 
    showResetData: false,
    logoutLabel: 'Log out',
    resetLabel: '',
  };
  
  // Apply prop overrides
  return {
    ...baseConfig,
    ...(props.showRegistration !== undefined && { showLoginRegistration: props.showRegistration })
  };
});

const regDialog = computed({
  get: () => authStore.loginAndRegistration.regDialogOpen,
  set: (value: boolean) => {
    authStore.loginAndRegistration.regDialogOpen = value;
  },
});

const loginDialog = computed({
  get: () => authStore.loginAndRegistration.loginDialogOpen,
  set: (value: boolean) => {
    authStore.loginAndRegistration.loginDialogOpen = value;
  },
});

const toggle = () => {
  if (regDialog.value && loginDialog.value) {
    throw new Error('Registration / Login dialogs both activated.');
  } else if (regDialog.value === loginDialog.value) {
    throw new Error('Registration / Login dialogs toggled while both were dormant.');
  } else {
    regDialog.value = !regDialog.value;
    loginDialog.value = !loginDialog.value;
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
