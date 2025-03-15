import 'roboto-fontface/css/roboto/roboto-fontface.css';
import { createApp } from 'vue';
import App from './App.vue';
import './registerServiceWorker';
import router from './router';
import { createPinia } from 'pinia';
import vuetify from './plugins/vuetify';
import { piniaPlugin } from '@vue-skuilder/common-ui';

const pinia = createPinia();
const app = createApp(App);

app.use(router);
app.use(vuetify);
app.use(pinia);
app.use(piniaPlugin, { pinia });
app.mount('#app');
