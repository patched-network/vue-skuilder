// packages/edit-ui/vite.config.js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { createBaseResolve } from '../../vite.config.base.js';

export default defineConfig({
  build: {
    target: 'es2020',
    minify: 'terser',
    sourcemap: true,
    terserOptions: {
      keep_classnames: true,
    },
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VueSkuilderEditUI',
      fileName: (format) => `edit-ui.${format}.js`,
    },
    rollupOptions: {
      // External packages that shouldn't be bundled
      external: [
        'vue',
        'vue-router',
        'vuetify',
        'pinia',
        '@vue-skuilder/db',
        '@vue-skuilder/common',
        '@vue-skuilder/common-ui',
      ],
      output: {
        // Global variables to use in UMD build for externalized deps
        globals: {
          vue: 'Vue',
          'vue-router': 'VueRouter',
          vuetify: 'Vuetify',
          pinia: 'Pinia',
          '@vue-skuilder/db': 'VueSkuilderDb',
          '@vue-skuilder/common': 'VueSkuilderCommon',
          '@vue-skuilder/common-ui': 'VueSkuilderCommonUI',
          sourcemap: true,
        },
        // Preserve CSS in the output bundles
        assetFileNames: (assetInfo) => {
          return `assets/[name][extname]`;
        },
      },
    },
    // This is crucial for component libraries - allow CSS to be in chunks
    cssCodeSplit: true,
  },
  plugins: [vue()],
  resolve: createBaseResolve(resolve(__dirname, '../..'), {
    '@eui': resolve(__dirname, 'src'), // Override for self-imports during build
  }),
});