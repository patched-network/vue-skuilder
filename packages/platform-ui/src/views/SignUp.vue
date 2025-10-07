<template>
  <v-container class="d-flex align-center maxWidth">
    <user-registration
      v-if="!isUserLoggedIn"
      @signup-success="handleSignupSuccess"
    />
    <div v-else>Already logged in! Welcome back!</div>
  </v-container>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { UserRegistration, useAuthStore } from '@vue-skuilder/common-ui';

export default defineComponent({
  name: 'LoginRoute',

  components: {
    UserRegistration,
  },

  computed: {
    isUserLoggedIn(): boolean {
      const authStore = useAuthStore();
      return authStore.isLoggedIn;
    },
  },

  methods: {
    handleSignupSuccess({ username }: { username: string }) {
      console.log('[PLATFORM-UI] Signup success, redirecting to:', `/u/${username}/new`);
      this.$router.push(`/u/${username}/new`);
    },
  },
});
</script>

<style lang="css" scoped>
.maxWidth {
  max-width: 650px;
}
</style>
