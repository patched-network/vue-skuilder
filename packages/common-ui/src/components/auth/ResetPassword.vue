<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6">
        <v-card>
          <v-card-title class="text-h5 bg-grey-lighten-2">
            Set New Password
          </v-card-title>

          <v-card-text class="pa-6">
            <v-form v-if="!isComplete" @submit.prevent="handleSubmit">
              <p class="mb-4">Enter your new password below.</p>

              <v-text-field
                v-model="password"
                prepend-icon="mdi-lock"
                name="password"
                label="New password"
                min="4"
                :append-icon="passwordVisible ? 'mdi-eye-off' : 'mdi-eye'"
                :type="passwordVisible ? 'text' : 'password'"
                :disabled="isSubmitting"
                @click:append="() => (passwordVisible = !passwordVisible)"
              ></v-text-field>

              <v-text-field
                v-model="confirmPassword"
                prepend-icon="mdi-lock"
                name="confirmPassword"
                label="Confirm new password"
                min="4"
                :type="passwordVisible ? 'text' : 'password'"
                :error="confirmPasswordError"
                :hint="confirmPasswordHint"
                :disabled="isSubmitting"
                @blur="validateConfirmPassword"
              ></v-text-field>

              <v-btn
                type="submit"
                color="primary"
                class="mt-4"
                :loading="isSubmitting"
                :disabled="!canSubmit"
                block
              >
                <v-icon start>mdi-lock-reset</v-icon>
                Reset Password
              </v-btn>
            </v-form>

            <!-- Success state -->
            <div v-else class="text-center">
              <v-icon color="success" size="64" class="mb-4">mdi-check-circle</v-icon>
              <h3 class="mb-2">Password Reset Successful!</h3>
              <p>Your password has been updated. You can now log in with your new password.</p>
            </div>
          </v-card-text>

          <v-card-actions v-if="isComplete">
            <v-spacer></v-spacer>
            <slot name="success-action">
              <!-- External apps can provide their own navigation -->
              <v-btn color="primary" @click="$emit('complete')">
                Continue to Login
              </v-btn>
            </slot>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { resetPassword } from '../../services/authAPI';
import { alertUser } from '../SnackbarService';
import { Status } from '@vue-skuilder/common';

export default defineComponent({
  name: 'ResetPassword',

  emits: ['complete', 'error'],

  props: {
    /**
     * Reset token. If not provided, will try to read from URL query params.
     */
    token: {
      type: String,
      default: null,
    },
  },

  data() {
    return {
      password: '',
      confirmPassword: '',
      passwordVisible: false,
      confirmPasswordError: false,
      confirmPasswordHint: '',
      isSubmitting: false,
      isComplete: false,
    };
  },

  computed: {
    canSubmit(): boolean {
      return (
        this.password.length >= 4 &&
        this.confirmPassword.length >= 4 &&
        this.password === this.confirmPassword &&
        !this.confirmPasswordError
      );
    },
  },

  methods: {
    validateConfirmPassword() {
      this.confirmPasswordError = false;
      this.confirmPasswordHint = '';

      if (!this.confirmPassword) return;

      if (this.password !== this.confirmPassword) {
        this.confirmPasswordError = true;
        this.confirmPasswordHint = 'Passwords do not match';
      }
    },

    async handleSubmit() {
      this.validateConfirmPassword();

      if (!this.canSubmit) {
        return;
      }

      // Get token from prop or URL query params
      const token = this.token || this.getTokenFromURL();

      if (!token) {
        alertUser({
          text: 'No reset token provided. Please use the link from your email.',
          status: Status.error,
        });
        this.$emit('error', 'No token');
        return;
      }

      this.isSubmitting = true;

      try {
        const result = await resetPassword(token, this.password);

        if (result.ok) {
          this.isComplete = true;
          alertUser({
            text: 'Password reset successfully!',
            status: Status.ok,
          });
        } else {
          alertUser({
            text: result.error || 'Failed to reset password',
            status: Status.error,
          });
          this.$emit('error', result.error);
        }
      } catch (error) {
        alertUser({
          text: 'An unexpected error occurred',
          status: Status.error,
        });
        this.$emit('error', 'Unexpected error');
      } finally {
        this.isSubmitting = false;
      }
    },

    getTokenFromURL(): string | null {
      if (typeof window === 'undefined') return null;

      const params = new URLSearchParams(window.location.search);
      return params.get('token');
    },
  },
});
</script>
