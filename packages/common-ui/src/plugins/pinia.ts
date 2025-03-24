// common-ui/src/plugins/pinia.ts
import { Plugin } from 'vue';
import { Pinia } from 'pinia';

// This will hold the Pinia instance provided by the main app
let _pinia: Pinia | null = null;

export const setPinia = (pinia: Pinia) => {
  _pinia = pinia;
};

export const getPinia = (): Pinia | null => {
  return _pinia;
};

// Create a plugin that the main app can use
export const piniaPlugin: Plugin = {
  // @ts-expect-error
  install(app, options) {
    const pinia = options?.pinia;
    if (pinia) {
      setPinia(pinia);
    }
  },
};
