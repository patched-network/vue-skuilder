import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { createBaseResolve } from '../../vite.config.base.js';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: createBaseResolve(resolve(__dirname, '..', '..')),
  server: {
    port: 7173, // Distinct from platform-ui (5173) and standalone-ui (6173)
    host: '0.0.0.0'
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
    rolldownOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('vue') || id.includes('vue-router') || id.includes('pinia')) return 'vue';
          if (id.includes('vuetify')) return 'vuetify';
        }
      }
    }
  }
});