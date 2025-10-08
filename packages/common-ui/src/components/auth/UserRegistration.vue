<template>
  <v-card>
    <v-card-title v-if="!registrationRoute" class="text-h5 bg-grey-lighten-2"> Create an Account </v-card-title>

    <v-card-text>
      <v-form @submit.prevent="createUser">
        <v-text-field
          v-model="email"
          name="email"
          label="Email address"
          type="email"
          prepend-icon="mdi-email"
          :error="emailError"
          :hint="emailHint"
          @blur="validateEmail"
        ></v-text-field>
        <v-text-field
          id=""
          ref="userNameTextField"
          v-model="username"
          name="username"
          label="Choose a Username"
          prepend-icon="mdi-account-circle"
          :error="usernameError"
          :hint="usernameHint"
          @blur="validateUsername"
        ></v-text-field>
        <v-text-field
          v-model="password"
          prepend-icon="mdi-lock"
          name="password"
          hover="Show password"
          label="Create a password"
          hint=""
          min="4"
          :append-icon="passwordVisible ? 'mdi-eye-off' : 'mdi-eye'"
          :type="passwordVisible ? 'text' : 'password'"
          @click:append="() => (passwordVisible = !passwordVisible)"
        ></v-text-field>
        <v-text-field
          v-model="retypedPassword"
          prepend-icon="mdi-lock"
          name="retypedPassword"
          hover="Show password"
          label="Retype your password"
          hint=""
          min="4"
          :type="passwordVisible ? 'text' : 'password'"
        ></v-text-field>

        <!-- <v-checkbox label="Student" v-model="student" ></v-checkbox>
            <v-checkbox label="Teacher" v-model="teacher" ></v-checkbox>
            <v-checkbox label="Author" v-model="author" ></v-checkbox> -->

        <v-snackbar v-model="badLoginAttempt" location="bottom right" :timeout="5000">
          Username or password was incorrect.
          <v-btn color="pink" variant="text" @click="badLoginAttempt = false"> Close </v-btn>
        </v-snackbar>
        <v-btn class="mr-2" type="submit" :loading="awaitingResponse" :color="buttonStatus.color">
          <v-icon start>mdi-lock-open</v-icon>
          Create Account
        </v-btn>
        <router-link v-if="registrationRoute" to="login">
          <v-btn variant="text">Log In</v-btn>
        </router-link>
        <v-btn v-else variant="text" @click="toggle"> Log In </v-btn>
      </v-form>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { UserDBInterface } from '@vue-skuilder/db';
import { alertUser } from '../SnackbarService';
import { Status, log } from '@vue-skuilder/common';
import { getCurrentUser, useAuthStore } from '../../stores/useAuthStore';
import { sendVerificationEmail } from '../../services/authAPI';

export default defineComponent({
  name: 'UserRegistration',

  emits: ['toggle', 'signup-success'],

  data() {
    return {
      email: '',
      username: '',
      password: '',
      retypedPassword: '',
      passwordVisible: false,
      emailError: false,
      emailHint: '',
      usernameValidationInProgress: false,
      usernameError: false,
      usernameHint: '',
      awaitingResponse: false,
      badLoginAttempt: false,
      userSecret: '',
      secret: 'goons',
      user: null as UserDBInterface | null,
      roles: ['Student', 'Teacher', 'Author'] as string[],
      student: true,
      teacher: false,
      author: false,
      authStore: useAuthStore(),
    };
  },

  computed: {
    registrationRoute(): boolean {
      return typeof this.$route.name === 'string' && this.$route.name.toLowerCase() === 'signup';
    },
    buttonStatus() {
      return {
        color: this.badLoginAttempt ? 'error' : 'success',
        text: this.badLoginAttempt ? 'Try again' : 'Log In',
      };
    },
  },

  async created() {
    this.user = await getCurrentUser();
  },

  methods: {
    toggle() {
      log('Toggling registration / login forms.');
      this.$emit('toggle');
    },

    validateEmail() {
      this.emailError = false;
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (this.email && !emailRegex.test(this.email)) {
        this.emailError = true;
        this.emailHint = 'Please enter a valid email address';
      } else {
        this.emailHint = '';
      }
    },

    validateUsername() {
      this.usernameError = false;
    },

    async createUser() {
      this.awaitingResponse = true;
      console.log('[SIGNUP-1] Starting user creation', {
        username: this.username,
        hasEmail: !!this.email,
        hasUser: !!this.user,
      });
      log(`
User creation
-------------

Name: ${this.username}
Student: ${this.student}
Teacher: ${this.teacher}
Author: ${this.author}
`);
      if (this.password === this.retypedPassword) {
        if (!this.user) {
          console.error('[SIGNUP-1] ERROR: No user object available');
          return;
        }

        this.user
          .createAccount(this.username, this.password)
          .then(async (resp: any) => {
            console.log('[SIGNUP-1] createAccount response:', resp);
            if (resp.status === Status.ok) {
              console.log('[SIGNUP-1] Account created successfully');
              // Account created successfully via PouchDB
              this.authStore.loginAndRegistration.loggedIn = true;
              this.authStore.loginAndRegistration.init = false;
              this.authStore.loginAndRegistration.init = true;

              // Save email to user config if provided
              if (this.email) {
                try {
                  const currentUser = await getCurrentUser();
                  await currentUser.setConfig({ email: this.email });

                  // Trigger verification email send with current origin
                  const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
                  console.log('[SIGNUP-1] Triggering verification email', { username: this.username, email: this.email, origin });
                  const verificationResult = await sendVerificationEmail(this.username, this.email, origin);
                  console.log('[SIGNUP-1] Verification email result:', verificationResult);
                  if (verificationResult.ok) {
                    alertUser({
                      text: 'Account created! Please check your email to verify your account.',
                      status: Status.ok,
                    });
                  } else {
                    console.warn('[SIGNUP-1] Verification email failed:', verificationResult.error);
                    log(`Warning: Failed to send verification email: ${verificationResult.error}`);
                    // Continue anyway - user can still use the account
                  }
                } catch (emailError) {
                  console.error('[SIGNUP-1] Email save/send error:', emailError);
                  log(`Warning: Failed to save email or send verification: ${emailError}`);
                  // Continue anyway - account was created successfully
                }
              }

              // Emit signup success event for parent to handle
              const username = (await getCurrentUser()).getUsername();
              console.log('[SIGNUP-1] Emitting signup-success event', { username });
              this.$emit('signup-success', { username });
            } else {
              if (resp.error === 'This username is taken!') {
                this.usernameError = true;
                this.usernameHint = 'Try a different name.';
                (this.$refs.userNameTextField as HTMLInputElement).focus();
                alertUser({
                  text: `The name ${this.username} is taken!`,
                  status: resp.status,
                });
              } else {
                alertUser({
                  text: resp.error,
                  status: resp.status,
                });
              }
            }
          })
          .catch((e) => {
            console.error('[SIGNUP-1] CATCH: createAccount threw error:', e);
            console.error('[SIGNUP-1] Error type:', typeof e);
            console.error('[SIGNUP-1] Error constructor:', e?.constructor?.name);
            console.error('[SIGNUP-1] Error message:', e?.message);
            console.error('[SIGNUP-1] Error stack:', e?.stack);
            if (e) {
              const errorText = e?.message || e?.error || e?.toString() || 'Account creation failed';
              alertUser({
                text: errorText,
                status: Status.error,
              });
            }
          });
        this.awaitingResponse = false;
      } else {
        alertUser({
          text: 'Passwords do not match.',
          status: Status.error,
        });
        this.awaitingResponse = false;
      }
    },
  },
});
</script>
