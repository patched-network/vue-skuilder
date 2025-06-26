import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';

// Vuetify
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import '@mdi/font/css/materialdesignicons.css';

// Component library styles
import '@vue-skuilder/courses/style';
import '@vue-skuilder/common-ui/style';

// Data layer initialization
import { initializeDataLayer } from '@vue-skuilder/db';

import App from './App.vue';

// Initialize Vuetify with all components and directives
const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'light'
  }
});

// Simple router for studio mode
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'studio',
      component: App
    }
  ]
});

(async () => {
  // Initialize data layer for studio mode with admin credentials
  // TODO: Get these values from CLI-provided configuration
  await initializeDataLayer({
    type: 'couch',
    options: {
      COUCHDB_SERVER_PROTOCOL: 'http',
      COUCHDB_SERVER_URL: 'localhost:5984/', // Use monorepo CouchDB port
      COUCHDB_USERNAME: 'admin',
      COUCHDB_PASSWORD: 'password',
    },
  });

  const pinia = createPinia();
  const app = createApp(App);

  // Register all course view components globally (like platform-ui)
  const { allCourses: Courses } = await import('@vue-skuilder/courses');
  const viewComponents = Courses.allViewsRaw();
  Object.entries(viewComponents).forEach(([name, component]) => {
    app.component(name, component);
  });

  app.use(pinia);
  app.use(vuetify);
  app.use(router);

  // Dynamically import piniaPlugin (like platform-ui)
  const { piniaPlugin, useAuthStore } = await import('@vue-skuilder/common-ui');
  app.use(piniaPlugin, { pinia });

  // Initialize auth store like standalone-ui does
  await useAuthStore().init();

  app.mount('#app');
})();