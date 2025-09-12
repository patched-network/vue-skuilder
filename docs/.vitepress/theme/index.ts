// https://vitepress.dev/guide/custom-theme
import { h } from 'vue';
import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';

// VitePress custom styles
import './style.css';

// Pinia for state management
import { createPinia } from 'pinia';

// Vue Router (create a minimal router for component compatibility)
import { createRouter, createWebHistory, createMemoryHistory } from 'vue-router';

// Vuetify setup
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { aliases, mdi } from 'vuetify/iconsets/mdi';

// Component library styles
import '@vue-skuilder/courseware/style';
import '@vue-skuilder/common-ui/style';

// Import components to register globally
import EmbeddedCourse from './components/EmbeddedCourse.vue';
import HeroStudySession from './components/HeroStudySession.vue';
import EmbeddedFillInEditor from './components/EmbeddedFillInEditor.vue';

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      // https://vitepress.dev/guide/extending-default-theme#layout-slots
    });
  },
  enhanceApp({ app, router, siteData }) {
    // Create and install Pinia
    const pinia = createPinia();
    app.use(pinia);

    // Create minimal Vue Router for component compatibility
    // Use MemoryHistory for SSR, WebHistory for client
    const vueRouter = createRouter({
      history: typeof window !== 'undefined' ? createWebHistory() : createMemoryHistory(),
      routes: [
        // Minimal route - VitePress handles actual routing
        { path: '/', component: { template: '<div></div>' } },
      ],
    });
    app.use(vueRouter);

    // Configure Vuetify
    const vuetify = createVuetify({
      components,
      directives,
      theme: {
        defaultTheme: 'light',
        themes: {
          light: {
            dark: false,
            colors: {
              primary: '#1976D2',
              secondary: '#424242',
              accent: '#82B1FF',
              error: '#F44336',
              info: '#2196F3',
              success: '#4CAF50',
              warning: '#FF9800',
              background: '#FFFFFF',
              surface: '#FFFFFF',
              'surface-bright': '#FFFFFF',
              'surface-light': '#EEEEEE',
              'surface-variant': '#E3F2FD',
              'on-surface-variant': '#1976D2',
              'primary-darken-1': '#1565C0',
              'secondary-darken-1': '#212121',
              'on-primary': '#FFFFFF',
              'on-secondary': '#FFFFFF',
              'on-background': '#212121',
              'on-surface': '#212121',
            },
          },
          dark: {
            dark: true,
            colors: {
              primary: '#2196F3',
              secondary: '#90A4AE',
              accent: '#82B1FF',
              error: '#FF5252',
              info: '#2196F3',
              success: '#4CAF50',
              warning: '#FFC107',
              background: '#121212',
              surface: '#1E1E1E',
              'surface-bright': '#2C2C2C',
              'surface-light': '#2C2C2C',
              'surface-variant': '#1A237E',
              'on-surface-variant': '#82B1FF',
              'primary-darken-1': '#1976D2',
              'secondary-darken-1': '#546E7A',
              'on-primary': '#000000',
              'on-secondary': '#000000',
              'on-background': '#FFFFFF',
              'on-surface': '#FFFFFF',
            },
          },
        },
      },
      icons: {
        defaultSet: 'mdi',
        aliases,
        sets: {
          mdi,
        },
      },
    });

    // Install Vuetify
    app.use(vuetify);

    // Register global components
    app.component('EmbeddedCourse', EmbeddedCourse);
    app.component('HeroStudySession', HeroStudySession);
    app.component('EmbeddedFillInEditor', EmbeddedFillInEditor);
  },
} satisfies Theme;
