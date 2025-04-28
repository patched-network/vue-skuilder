<template>
  <v-container class="d-flex align-center login">
    <user-login v-if="!isUserLoggedIn" />
    <v-card v-else class="w-100 pa-4">
      <v-card-title class="text-center"> Already logged in! </v-card-title>
      <v-card-text class="text-center">
        You are currently logged in as <strong>{{ username }}</strong
        >.
      </v-card-text>
      <v-card-actions class="justify-center">
        <v-btn color="primary" @click="logout">
          <v-icon start>mdi-logout</v-icon>
          Log out
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import UserLogin from '@/components/UserLogin.vue';
import { getCurrentUser, useAuthStore } from '@vue-skuilder/common-ui';
import { useConfigStore } from '@/stores/useConfigStore';

export default defineComponent({
  name: 'LoginRoute',

  components: {
    UserLogin,
  },

  data() {
    return {
      username: '',
      authStore: useAuthStore(),
      configStore: useConfigStore(),
    };
  },

  computed: {
    isUserLoggedIn(): boolean {
      return this.authStore.isLoggedIn;
    },
  },

  created() {
    if (this.isUserLoggedIn) {
      getCurrentUser().then((u) => {
        this.username = u.getUsername();
      });
    }
  },

  methods: {
    async logout() {
      const res = await this.authStore._user!.logout();
      if (res.ok) {
        this.authStore.loginAndRegistration = {
          init: true,
          loggedIn: false,
          regDialogOpen: false,
          loginDialogOpen: false,
        };

        this.configStore.resetDefaults();
      }
    },
  },
});
</script>

<style lang="css" scoped>
.login {
  max-width: 650px;
}
</style>
