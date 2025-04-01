import 'roboto-fontface/css/roboto/roboto-fontface.css';
import { createApp } from 'vue';
import App from './App.vue';
import './registerServiceWorker';
import router from './router';
import { createPinia } from 'pinia';
import vuetify from './plugins/vuetify';
// common-ui imports
import { piniaPlugin } from '@vue-skuilder/common-ui';
import '@vue-skuilder/common-ui/style';
// `courses` imports
import Courses from '@vue-skuilder/courses';
import '@vue-skuilder/courses/style';
// `db` import and initialization
import { initializeDataLayer } from '@vue-skuilder/db';
import { getCurrentUser } from './stores/useAuthStore';

const pinia = createPinia();
const app = createApp(App);

// Register all view components globally
const viewComponents = Courses.allViewsRaw();
Object.entries(viewComponents).forEach(([name, component]) => {
  app.component(name, component);
});

app.use(router);
app.use(vuetify);
app.use(pinia);
app.use(piniaPlugin, { pinia });
app.mount('#app');

(async function initializeDb() {
  await initializeDataLayer({
    type: 'pouch',
    options: {
      userGetter: getCurrentUser,
    },
  });
})();
