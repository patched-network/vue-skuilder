<template>
  <v-app-bar>
    <v-app-bar-nav-icon v-if="isMobile"></v-app-bar-nav-icon>

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
  </v-app-bar>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDisplay } from 'vuetify';

const props = defineProps<{
  title: string;
  logo?: string;
}>();

const { mobile } = useDisplay();
const isMobile = computed(() => mobile.value);

const menuItems = ref([
  { text: 'Home', path: '/' },
  { text: 'Study', path: '/study' },
  { text: 'Progress', path: '/progress' },
]);
</script>
