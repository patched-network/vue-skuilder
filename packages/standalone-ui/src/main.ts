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

  const vuetify = createVuetify({
    components,
    directives,
    theme: {
      defaultTheme: 'light',
    },
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
