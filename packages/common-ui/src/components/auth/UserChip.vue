<template>
  <v-badge :content="items.length" :model-value="hasNewItems" color="accent" location="end top">
    <v-menu location="bottom end" transition="scale-transition">
      <template #activator="{ props }">
        <v-chip v-bind="props" class="ma-2">
          <v-avatar start class="bg-primary">
            <v-icon>mdi-school</v-icon>
          </v-avatar>
          {{ username }}
        </v-chip>
      </template>

      <v-list>
        <v-list-item v-for="item in items" :key="item" @click="dismiss(item)">
          <v-list-item-title>{{ item }}</v-list-item-title>
        </v-list-item>

        <v-divider v-if="items.length" />

        <v-list-item @click="gotoStats">
          <template #prepend>
            <v-icon>mdi-trending-up</v-icon>
          </template>
          <v-list-item-title>Stats</v-list-item-title>
        </v-list-item>

        <v-list-item @click="gotoSettings">
          <template #prepend>
            <v-icon>mdi-cog</v-icon>
          </template>
          <v-list-item-title>Settings</v-list-item-title>
        </v-list-item>

        <v-list-item @click="logout">
          <template #prepend>
            <v-icon>mdi-logout</v-icon>
          </template>
          <v-list-item-title>Log out</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </v-badge>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { getCurrentUser, useAuthStore } from '@/stores/useAuthStore';
import { useConfigStore } from '@/stores/useConfigStore';

export default defineComponent({
  name: 'UserChip',

  data() {
    return {
      username: '',
      items: [] as string[],
      checked: false,
      authStore: useAuthStore(),
      configStore: useConfigStore(),
    };
  },

  computed: {
    hasNewItems(): boolean {
      return this.items.length > 0;
    },
  },

  created() {
    getCurrentUser().then((u) => {
      this.username = u.getUsername();
    });
  },

  methods: {
    async gotoSettings() {
      this.$router.push(`/u/${(await getCurrentUser()).getUsername()}`);
    },

    async gotoStats() {
      this.$router.push(`/u/${(await getCurrentUser()).getUsername()}/stats`);
    },

    dismiss(item: string) {
      const index = this.items.indexOf(item);
      this.items.splice(index, 1);
    },

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

        this.$router.push('/home');
      }
    },
  },
});
</script>
