<template>
  <div>
    <v-app-bar>
      <v-app-bar-nav-icon v-if="isMobile" @click="drawer = !drawer"></v-app-bar-nav-icon>

      <v-toolbar-title class="d-flex align-center">
        <img v-if="logo" :src="logo" alt="Course Logo" height="32" class="mr-2" />
        {{ title }}
      </v-toolbar-title>

      <v-spacer></v-spacer>

      <div v-if="!isMobile" class="d-flex">
        <v-btn v-for="item in menuItems" :key="item.text" :to="item.path" text>
          {{ item.text }}
        </v-btn>
      </div>

      <v-divider vertical class="mx-2"></v-divider>

      <UserLoginAndRegistrationContainer :show-login-button="true" redirect-to-path="/study" />
    </v-app-bar>

    <v-navigation-drawer v-model="drawer" temporary v-if="isMobile">
      <v-list>
        <v-list-item v-for="item in menuItems" :key="item.text" :to="item.path" @click="drawer = false">
          <v-list-item-title>{{ item.text }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDisplay } from 'vuetify';
import { UserLoginAndRegistrationContainer } from '@vue-skuilder/common-ui';

// Define props
defineProps<{
  title?: string;
  logo?: string;
}>();

const { mobile } = useDisplay();
const isMobile = computed(() => mobile.value);
const drawer = ref(false);

const menuItems = ref([
  { text: 'Home', path: '/' },
  { text: 'Study', path: '/study' },
  { text: 'Browse', path: '/browse' },
  // Progress view not implemented - will be accessible via UserChip->Stats
]);
</script>
