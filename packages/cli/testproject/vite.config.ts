// packages/standalone-ui/vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // Alias for internal src paths
      '@': fileURLToPath(new URL('./src', import.meta.url)),

      // Add events alias if needed (often required by dependencies)
      events: 'events',
    },
    extensions: ['.js', '.ts', '.json', '.vue'],
    dedupe: [
      // Ensure single instances of core libs and published packages
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
  // --- Dependencies optimization ---
  optimizeDeps: {
    // Help Vite pre-bundle dependencies from published packages
    include: [
      '@vue-skuilder/common-ui',
      '@vue-skuilder/db',
      '@vue-skuilder/common',
      '@vue-skuilder/courses',
    ],
  },
  server: {
    port: 5173, // Use standard Vite port for standalone projects
  },
  build: {
    sourcemap: true,
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      keep_classnames: true,
    },
  },
  // Add define block for process polyfills
  define: {
    global: 'window',
    'process.env': process.env,
    'process.browser': true,
    'process.version': JSON.stringify(process.version),
  },
});
