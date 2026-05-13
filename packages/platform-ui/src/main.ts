import ENV from './ENVIRONMENT_VARS';

import 'roboto-fontface/css/roboto/roboto-fontface.css';
import { createApp } from 'vue';
import App from './App.vue';
import './registerServiceWorker';
import router from './router';
import { createPinia } from 'pinia';
import vuetify from './plugins/vuetify';

// styles from component library packages
import '@vue-skuilder/courseware/style';
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

  // Dynamically import { allCourseWare } and register all built-in courses.
  // As of the courseware tree-shaking refactor, `allCourseWare` starts empty;
  // platform-ui historically depended on all subcourses being available, so
  // we eagerly load them all here. See packages/courseware/src/index.ts.
  const {
    allCourseWare: Courses,
    defaultCourse,
    loadAllSubcourses,
  } = await import('@vue-skuilder/courseware');
  if (!Courses.courses.find((c) => c.name === defaultCourse.name)) {
    Courses.courses.push(defaultCourse);
  }
  await loadAllSubcourses();

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

  // Provide inline markdown components for MarkdownRenderer
  // Enables custom Vue components in markdown via {{ <component-name /> }} syntax
  // See docs: https://patched-network.github.io/vue-skuilder/do/inline-components
  app.provide('markdownComponents', {
    // Empty - add components as needed
  });

  app.mount('#app');
})();
