// Default eduQuilt host entry.
//
// All app construction now lives in `createPlatformApp` (the consumable
// library surface — see ./index.ts). This entry exists only to (a) register
// the PWA service worker, which is an app-shell concern that library consumers
// must NOT inherit, and (b) boot the shell with built-in defaults and mount it.
//
// Consuming apps (e.g. diffdoc) should import `createPlatformApp` from
// `@vue-skuilder/platform-ui` and supply their own env / theme / routes.
import './registerServiceWorker';
import { createPlatformApp } from './createPlatformApp';

void createPlatformApp().then(({ mount }) => mount('#app'));
