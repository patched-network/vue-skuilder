<template>
  <v-card>
    <v-card-title v-if="!loginRoute" class="text-h5 bg-grey-lighten-2">Log In</v-card-title>

    <v-card-text>
      <v-form onsubmit="return false;" @submit.prevent="login">
        <v-text-field
          id=""
          v-model="username"
          autofocus
          name="username"
          label="Username"
          prepend-icon="mdi-account-circle"
        ></v-text-field>
        <v-text-field
          v-model="password"
          prepend-icon="mdi-lock"
          name="password"
          hover="Show password input"
          label="Enter your password"
          hint=""
          min="0"
          :append-icon="passwordVisible ? 'mdi-eye-off' : 'mdi-eye'"
          :type="passwordVisible ? 'text' : 'password'"
          @click:append="() => (passwordVisible = !passwordVisible)"
        ></v-text-field>

        <v-snackbar v-model="badLoginAttempt" location="bottom right" :timeout="errorTimeout">
          Username or password was incorrect.
          <v-btn color="pink" variant="text" @click="badLoginAttempt = false">Close</v-btn>
        </v-snackbar>

        <div class="d-flex flex-column align-start">
          <div class="mb-2">
            <v-btn class="mr-2" type="submit" :loading="awaitingResponse" :color="buttonStatus.color">
              <v-icon start>mdi-lock-open</v-icon>
              Log In
            </v-btn>
            <router-link v-if="loginRoute" to="signup">
              <v-btn variant="text">Create New Account</v-btn>
            </router-link>
            <v-btn v-else variant="text" @click="toggle">Create New Account</v-btn>
          </div>

          <slot name="forgot-password">
            <!-- Default: simple link that can be overridden by parent -->
            <router-link v-if="loginRoute" to="/request-reset" class="text-caption text-decoration-none">
              Forgot password?
            </router-link>
          </slot>
        </div>
      </v-form>
    </v-card-text>
  </v-card>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { alertUser } from '../SnackbarService';
import { log } from '@vue-skuilder/common';
import { Status } from '@vue-skuilder/common';
import { User } from '@vue-skuilder/db';
import { getCurrentUser, useAuthStore } from '../../stores/useAuthStore';
import { useConfigStore } from '../../stores/useConfigStore';

// Define props
interface Props {
  redirectTo?: string;
}

const props = withDefaults(defineProps<Props>(), {
  redirectTo: '/study'
});

// Define emits for toggle and cleanup
const emit = defineEmits<{
  toggle: [];
  loginSuccess: [redirectPath: string];
}>();

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const configStore = useConfigStore();

const username = ref('');
const password = ref('');
const passwordVisible = ref(false);
const awaitingResponse = ref(false);
const badLoginAttempt = ref(false);
const errorTimeout = ref(7000);
const user = ref<User | undefined>(undefined);

const loginRoute = computed(() => route.name === 'login');

const buttonStatus = computed(() => ({
  color: badLoginAttempt.value ? 'error' : 'success',
  text: badLoginAttempt.value ? 'Try again' : 'Log In',
}));

const initBadLogin = () => {
  badLoginAttempt.value = true;

  alertUser({
    text: 'Username or password was incorrect.',
    status: Status.error,
    timeout: errorTimeout.value,
  });
  setTimeout(() => {
    badLoginAttempt.value = false;
  }, errorTimeout.value);
};

const login = async () => {
  awaitingResponse.value = true;
  log('Starting login attempt');
  log(`Login attempt for username: ${username.value}`);

  try {
    log('Attempting to get User instance');
    // #172 starting point - why is the pre-existing _user being referenced here?
    user.value = await getCurrentUser();
    log('Got User instance, attempting login');

    await user.value.login(username.value, password.value);
    log('Login successful');

    // load user config
    log('Initializing user config');
    configStore.init();
    log('User config initialized');

    // set login state
    log('Setting authentication state');
    authStore.loginAndRegistration.loggedIn = true;
    log(`Authentication state set, redirecting to: ${props.redirectTo}`);
    
    // Emit success event for cleanup
    emit('loginSuccess', props.redirectTo);
    
    router.push(props.redirectTo);
    log('Login and redirect complete');
  } catch (e) {
    // entry #186
    log('Login attempt failed');
    log(`Login error details: ${JSON.stringify(e)}`);
    console.log(`login error: ${JSON.stringify(e)}`);
    // - differentiate response
    // - return better message to UI
    log('Initiating bad login feedback');
    initBadLogin();
  }

  log('Resetting awaiting response state');
  awaitingResponse.value = false;
};


const toggle = () => {
  log('Toggling registration / login forms.');
  emit('toggle');
};
</script>

<style lang="css" scoped>
.login {
  max-width: 650px;
}
</style>
