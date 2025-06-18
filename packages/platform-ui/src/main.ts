import ENV from './ENVIRONMENT_VARS';

import 'roboto-fontface/css/roboto/roboto-fontface.css';
import { createApp } from 'vue';
import App from './App.vue';
import './registerServiceWorker';
import router from './router';
import { createPinia } from 'pinia';
import vuetify from './plugins/vuetify';

// styles from component library packages
import '@vue-skuilder/courses/style';
import '@vue-skuilder/common-ui/style';

// `db` import and initialization
import { initializeDataLayer } from '@vue-skuilder/db';

(async () => {
  await initializeDataLayer({
    type: 'couch',
    options: {
      COUCHDB_SERVER_PROTOCOL: ENV.COUCHDB_SERVER_PROTOCOL,
      COUCHDB_SERVER_URL: ENV.COUCHDB_SERVER_URL,
    },
  });

  const pinia = createPinia();
  const app = createApp(App);

  // Dynamically import { allCourses }
  const { allCourses: Courses } = await import('@vue-skuilder/courses');

  // Register all view components globally
  const viewComponents = Courses.allViewsRaw();
  Object.entries(viewComponents).forEach(([name, component]) => {
    app.component(name, component);
  });

  app.use(router);
  app.use(vuetify);
  app.use(pinia);

  // Dynamically import piniaPlugin
  const { piniaPlugin } = await import('@vue-skuilder/common-ui');
  app.use(piniaPlugin, { pinia });

  app.mount('#app');
})();
