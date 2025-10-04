<template>
  <v-card>
    <v-card-title class="text-h5 bg-grey-lighten-2">
      Reset Password
    </v-card-title>

    <v-card-text class="pa-6">
      <v-form v-if="!requestSent" @submit.prevent="handleSubmit">
        <p class="mb-4">
          Enter your email address and we'll send you a link to reset your password.
        </p>

        <v-text-field
          v-model="email"
          name="email"
          label="Email address"
          type="email"
          prepend-icon="mdi-email"
          :error="emailError"
          :hint="emailHint"
          :disabled="isSubmitting"
          @blur="validateEmail"
        ></v-text-field>

        <v-btn
          type="submit"
          color="primary"
          class="mt-4"
          :loading="isSubmitting"
          :disabled="!email || emailError"
          block
        >
          <v-icon start>mdi-email-send</v-icon>
          Send Reset Link
        </v-btn>
      </v-form>

      <!-- Success message -->
      <div v-else class="text-center">
        <v-icon color="success" size="64" class="mb-4">mdi-email-check</v-icon>
        <h3 class="mb-2">Check Your Email</h3>
        <p>
          If an account exists with <strong>{{ email }}</strong>, you will receive a password
          reset link shortly.
        </p>
        <p class="text-caption mt-4">Didn't receive an email? Check your spam folder.</p>
      </div>
    </v-card-text>

    <v-card-actions v-if="!requestSent">
      <slot name="back-action">
        <!-- External apps can provide their own back button -->
        <v-btn variant="text" @click="$emit('cancel')">
          Cancel
        </v-btn>
      </slot>
      <v-spacer></v-spacer>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { requestPasswordReset } from '../../services/authAPI';
import { alertUser } from '../SnackbarService';
import { Status } from '@vue-skuilder/common';

export default defineComponent({
  name: 'RequestPasswordReset',

  emits: ['cancel', 'success'],

  data() {
    return {
      email: '',
      emailError: false,
      emailHint: '',
      isSubmitting: false,
      requestSent: false,
    };
  },

  methods: {
    validateEmail() {
      this.emailError = false;
      this.emailHint = '';

      if (!this.email) return;

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.email)) {
        this.emailError = true;
        this.emailHint = 'Please enter a valid email address';
      }
    },

    async handleSubmit() {
      this.validateEmail();

      if (this.emailError || !this.email) {
        return;
      }

      this.isSubmitting = true;

      try {
        const result = await requestPasswordReset(this.email);

        if (result.ok) {
          this.requestSent = true;
          this.$emit('success', this.email);
        } else {
          alertUser({
            text: result.error || 'Failed to send reset email',
            status: Status.error,
          });
        }
      } catch (error) {
        alertUser({
          text: 'An unexpected error occurred',
          status: Status.error,
        });
      } finally {
        this.isSubmitting = false;
      }
    },
  },
});
</script>
