<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6">
        <v-card>
          <v-card-title class="text-h5 bg-grey-lighten-2">
            Email Verification
          </v-card-title>

          <v-card-text class="pa-6">
            <!-- Loading state -->
            <div v-if="isVerifying" class="text-center">
              <v-progress-circular
                indeterminate
                color="primary"
                size="64"
                class="mb-4"
              ></v-progress-circular>
              <p>Verifying your email...</p>
            </div>

            <!-- Success state -->
            <div v-else-if="verificationStatus === 'success'" class="text-center">
              <v-icon color="success" size="64" class="mb-4">mdi-check-circle</v-icon>
              <h3 class="mb-2">Email Verified!</h3>
              <p>Your account has been successfully verified.</p>
              <p v-if="username">Welcome, {{ username }}!</p>
            </div>

            <!-- Error state -->
            <div v-else-if="verificationStatus === 'error'" class="text-center">
              <v-icon color="error" size="64" class="mb-4">mdi-alert-circle</v-icon>
              <h3 class="mb-2">Verification Failed</h3>
              <p>{{ errorMessage }}</p>
            </div>

            <!-- No token state -->
            <div v-else class="text-center">
              <v-icon color="warning" size="64" class="mb-4">mdi-help-circle</v-icon>
              <h3 class="mb-2">No Verification Token</h3>
              <p>Please use the link from your verification email.</p>
            </div>
          </v-card-text>

          <v-card-actions>
            <v-spacer></v-spacer>
            <slot name="actions" :status="verificationStatus" :username="username">
              <!-- Default action - external apps can override with their own navigation -->
              <v-btn
                v-if="verificationStatus === 'success'"
                color="primary"
                @click="$emit('verified', username)"
              >
                Continue
              </v-btn>
              <v-btn
                v-else-if="verificationStatus === 'error'"
                variant="text"
                @click="$emit('error', errorMessage)"
              >
                Close
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
import { verifyEmail } from '../../services/authAPI';
import { alertUser } from '../SnackbarService';
import { Status } from '@vue-skuilder/common';

export default defineComponent({
  name: 'VerifyEmail',

  emits: ['verified', 'error'],

  props: {
    /**
     * Verification token. If not provided, will try to read from URL query params.
     */
    token: {
      type: String,
      default: null,
    },
  },

  data() {
    return {
      isVerifying: false,
      verificationStatus: null as 'success' | 'error' | null,
      errorMessage: '',
      username: '',
    };
  },

  async mounted() {
    await this.performVerification();
  },

  methods: {
    async performVerification() {
      // Get token from prop or URL query params
      const token = this.token || this.getTokenFromURL();

      if (!token) {
        this.verificationStatus = 'error';
        this.errorMessage = 'No verification token provided';
        return;
      }

      this.isVerifying = true;

      try {
        const result = await verifyEmail(token);

        if (result.ok) {
          this.verificationStatus = 'success';
          this.username = result.username || '';
          alertUser({
            text: 'Email verified successfully!',
            status: Status.ok,
          });
        } else {
          this.verificationStatus = 'error';
          this.errorMessage = result.error || 'Verification failed';
          alertUser({
            text: result.error || 'Verification failed',
            status: Status.error,
          });
        }
      } catch (error) {
        this.verificationStatus = 'error';
        this.errorMessage = 'An unexpected error occurred';
        alertUser({
          text: 'An unexpected error occurred',
          status: Status.error,
        });
      } finally {
        this.isVerifying = false;
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
