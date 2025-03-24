<template>
  <v-container class="d-flex align-center maxWidth">
    <user-registration v-if="!isUserLoggedIn" />
    <div v-else>Already logged in! Welcome back!</div>
  </v-container>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import UserRegistration from '@/components/UserRegistration.vue';
import { useAuthStore } from '@/stores/useAuthStore';

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
});
</script>

<style lang="css" scoped>
.maxWidth {
  max-width: 650px;
}
</style>
