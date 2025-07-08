<template>
  <v-app>
    <course-header :title="courseConfig.title" :logo="courseConfig.logo" />

    <v-main>
      <router-view />
    </v-main>

    <!-- <course-footer :links="courseConfig.links" :copyright="courseConfig.copyright" /> -->
    <SkMouseTrap />
    
    <v-footer app class="pa-0" color="transparent">
      <v-card flat width="100%" class="text-center">
        <v-card-text class="text-body-2 text-medium-emphasis">
          <v-icon small class="me-1">mdi-keyboard</v-icon>
          Tip: Hold <kbd>Ctrl</kbd> to see keyboard shortcuts or press <kbd>?</kbd> to view all shortcuts
        </v-card-text>
      </v-card>
    </v-footer>
  </v-app>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useTheme } from 'vuetify';
import { useCourseConfig } from './composables/useCourseConfig';
import CourseHeader from './components/CourseHeader.vue';
import CourseFooter from './components/CourseFooter.vue';
import { SkMouseTrap, SkldrMouseTrap, useConfigStore } from '@vue-skuilder/common-ui';

const { courseConfig } = useCourseConfig();
const configStore = useConfigStore();
const theme = useTheme();

// Use the configStore dark mode instead of courseConfig
const dark = computed(() => {
  return configStore.config.darkMode;
});

// Watch for dark mode changes and update Vuetify theme
watch(
  dark,
  (newVal) => {
    theme.global.name.value = newVal ? 'dark' : 'light';
  },
  { immediate: true }
);

onMounted(() => {
  // Add a global shortcut to show the keyboard shortcuts dialog
  SkldrMouseTrap.addBinding({
    hotkey: '?',
    command: 'Show keyboard shortcuts',
    callback: () => {
      const keyboardButton = document.querySelector('.mdi-keyboard');
      if (keyboardButton) {
        (keyboardButton as HTMLElement).click();
      }
    }
  });
});
</script>
