<template>
  <verify-email @verified="handleVerified" @error="handleError">
    <template #success-action>
      <v-btn color="primary" @click="goToLogin">
        Continue to Login
      </v-btn>
    </template>
    <template #error-action>
      <v-btn variant="text" @click="goToHome">
        Back to Home
      </v-btn>
    </template>
  </verify-email>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { VerifyEmail } from '@vue-skuilder/common-ui';

export default defineComponent({
  name: 'VerifyEmailView',

  components: {
    VerifyEmail,
  },

  methods: {
    handleVerified(username: string) {
      console.log(`User ${username} verified successfully`);
    },

    handleError(error: string) {
      console.error('Verification error:', error);
    },

    goToLogin() {
      this.$router.push({ name: 'login' });
    },

    goToHome() {
      this.$router.push({ name: 'home' });
    },
  },
});
</script>
