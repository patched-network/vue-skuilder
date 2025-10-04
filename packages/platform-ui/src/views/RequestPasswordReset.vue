<template>
  <v-container class="d-flex align-center request-reset">
    <request-password-reset @cancel="goToLogin" @success="handleSuccess" />
  </v-container>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { RequestPasswordReset } from '@vue-skuilder/common-ui';

export default defineComponent({
  name: 'RequestPasswordResetView',

  components: {
    RequestPasswordReset,
  },

  methods: {
    handleSuccess(email: string) {
      console.log(`Password reset email sent to ${email}`);
    },

    goToLogin() {
      this.$router.push({ name: 'login' });
    },
  },
});
</script>

<style lang="css" scoped>
.request-reset {
  max-width: 650px;
}
</style>
