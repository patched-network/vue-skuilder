import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { createBaseResolve } from '../../vite.config.base.js';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    server: {
      deps: {
        inline: ['vuetify'],
      },
    },
  },
  resolve: createBaseResolve(resolve(__dirname, '../..'), {
    '@': resolve(__dirname, 'src'),
  }),
});