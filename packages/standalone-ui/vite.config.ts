// packages/standalone-ui/vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { fileURLToPath, URL } from 'node:url'; // Import necessary Node.js modules

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // Alias for internal src paths
      '@': fileURLToPath(new URL('./src', import.meta.url)), // Use fileURLToPath and URL for robustness

      // --- Link workspace packages to their SOURCE ---
      // Adjust relative paths as needed based on your monorepo structure
      // '@vue-skuilder/common-ui': resolve(__dirname, '../../packages/common-ui/src/index.ts'), // Removed - now uses built package

      // Add events alias if needed (often required by dependencies)
      events: 'events',

      // You might need to alias vue-router if dedupe isn't enough, though unlikely
      // 'vue-router': resolve(__dirname, 'node_modules/vue-router'),
    },
    extensions: ['.js', '.ts', '.json', '.vue'], // Keep standard extensions
    dedupe: [
      // Ensure single instances of core libs and workspace packages
      'vue',
      'vuetify',
      'pinia',
      'vue-router',
      '@vue-skuilder/db',
      '@vue-skuilder/common',
      '@vue-skuilder/common-ui',
      '@vue-skuilder/courses',
    ],
  },
  // --- Important for linked source dependencies ---
  optimizeDeps: {
    // Help Vite pre-bundle dependencies from linked packages
    include: [
      '@vue-skuilder/common-ui',
      '@vue-skuilder/db',
      '@vue-skuilder/common',
      '@vue-skuilder/courses',
    ],
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
