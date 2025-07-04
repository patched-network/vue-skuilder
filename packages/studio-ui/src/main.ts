import { createApp } from 'vue';
import { createPinia } from 'pinia';


// Vuetify
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import '@mdi/font/css/materialdesignicons.css';

// Component library styles
import '@vue-skuilder/courses/style';
import '@vue-skuilder/common-ui/style';
import '@vue-skuilder/edit-ui/style';

// Data layer initialization
import { initializeDataLayer } from '@vue-skuilder/db';

import App from './App.vue';
import router from './router';
import { getStudioConfig, getConfigErrorMessage } from './config/development';

// Initialize Vuetify with all components and directives
const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'light',
  },
});

(async () => {
  // Get studio configuration (CLI-injected or environment variables)
  const studioConfig = getStudioConfig();

  if (!studioConfig) {
    throw new Error(getConfigErrorMessage());
  }

  // Parse the CLI-provided CouchDB URL (format: http://localhost:5985)
  const couchUrl = new URL(studioConfig.couchdb.url);
  const serverUrl = `${couchUrl.hostname}:${couchUrl.port}/`;

  console.log('🎨 Studio Mode: Initializing data layer with CLI-provided CouchDB connection');
  console.log(`   Server: ${couchUrl.protocol}//${serverUrl}`);
  console.log(`   Username: ${studioConfig.couchdb.username}`);

  await initializeDataLayer({
    type: 'couch',
    options: {
      COUCHDB_SERVER_PROTOCOL: couchUrl.protocol.replace(':', ''),
      COUCHDB_SERVER_URL: serverUrl,
      COUCHDB_USERNAME: studioConfig.couchdb.username,
      COUCHDB_PASSWORD: studioConfig.couchdb.password,
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
