// packages/standalone-ui/vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { createBaseResolve } from '../../vite.config.base.js';

export default defineConfig({
  plugins: [vue()],
  resolve: createBaseResolve(resolve(__dirname, '../..'), {
    // Add events alias if needed (often required by dependencies)
    events: 'events',
  }),
  // --- Important for linked source dependencies ---
  optimizeDeps: {
    include: ['events'],
  },
  server: {
    port: 6173, // distinct from platform-ui
  },
  build: {
    sourcemap: true, // Keep sourcemaps for build
    target: 'es2020', // Match target from platform-ui
    minify: 'terser', // Match minify from platform-ui
    terserOptions: {
      // Match terserOptions from platform-ui
      keep_classnames: true,
    },
  },
  // Add define block if standalone-ui needs process polyfills (like platform-ui did)
  define: {
    global: 'window',
    'process.env': process.env,
    'process.browser': true,
    'process.version': JSON.stringify(process.version),
  },
});
