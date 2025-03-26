import { registerSW } from 'virtual:pwa-register';

if (import.meta.env.PROD) {
  registerSW({
    onNeedRefresh() {
      console.log('New content is available; please refresh.');
    },
    onOfflineReady() {
      console.log('Content has been cached for offline use.');
    },
    onRegistered() {
      console.log('Service worker has been registered.');
    },
    onRegisterError(error) {
      console.error('Error during service worker registration:', error);
    },
  });
}
