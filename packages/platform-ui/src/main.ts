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
import '@vue-skuilder/courses/style';

const pinia = createPinia();
const app = createApp(App);

app.use(router);
app.use(vuetify);
app.use(pinia);
app.use(piniaPlugin, { pinia });
app.mount('#app');
