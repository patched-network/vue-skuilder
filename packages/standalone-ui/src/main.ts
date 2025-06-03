import ENV from './ENVIRONMENT_VARS';
import '@mdi/font/css/materialdesignicons.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';

// Vuetify
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { aliases, mdi } from 'vuetify/iconsets/mdi';

// data layer
import { initializeDataLayer } from '@vue-skuilder/db';

// auth store
import { useAuthStore } from '@vue-skuilder/common-ui';

// theme configuration
import config from '../skuilder.config.json';

(async () => {
  await initializeDataLayer({
    type: 'pouch',
    options: {
      COUCHDB_SERVER_URL: ENV.COUCHDB_SERVER_URL,
      COUCHDB_SERVER_PROTOCOL: ENV.COUCHDB_SERVER_PROTOCOL,
      COURSE_IDS: [ENV.STATIC_COURSE_ID],
    },
  });
  const pinia = createPinia();

  // Apply theme configuration from skuilder.config.json
  const themeConfig = config.theme ? {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: config.theme.colors.primary,
          secondary: config.theme.colors.secondary,
          accent: config.theme.colors.accent,
          error: '#FF5252', // Default error color
          info: '#2196F3', // Default info color
          success: '#4CAF50', // Default success color
          warning: '#FFC107', // Default warning color
        },
      },
    },
  } : {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#1976D2', // Default primary color
          secondary: '#424242', // Default secondary color
          accent: '#82B1FF', // Default accent color
          error: '#FF5252', // Default error color
          info: '#2196F3', // Default info color
          success: '#4CAF50', // Default success color
          warning: '#FFC107', // Default warning color
        },
      },
    },
  };

  const vuetify = createVuetify({
    components,
    directives,
    theme: themeConfig,
    icons: {
      defaultSet: 'mdi',
      aliases,
      sets: {
        mdi,
      },
    },
  });

  const app = createApp(App);

  app.use(router);
  app.use(vuetify);
  app.use(pinia);

  const { piniaPlugin } = await import('@vue-skuilder/common-ui');
  app.use(piniaPlugin, { pinia });

  await useAuthStore().init();

  app.mount('#app');
})();
