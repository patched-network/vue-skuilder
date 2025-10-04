<template>
  <reset-password @complete="handleComplete" @error="handleError">
    <template #success-action>
      <v-btn color="primary" @click="goToLogin">
        Continue to Login
      </v-btn>
    </template>
  </reset-password>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { ResetPassword } from '@vue-skuilder/common-ui';

export default defineComponent({
  name: 'ResetPasswordView',

  components: {
    ResetPassword,
  },

  methods: {
    handleComplete() {
      console.log('Password reset successfully');
    },

    handleError(error: string) {
      console.error('Password reset error:', error);
    },

    goToLogin() {
      this.$router.push({ name: 'login' });
    },
  },
});
</script>
