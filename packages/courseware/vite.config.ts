import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { createBaseResolve } from '../../vite.config.base.js';

export default defineConfig({
  plugins: [
    vue({}),
    dts({
      insertTypesEntry: true,
      // Exclude test files from type generation
      exclude: ['**/*.spec.ts', '**/*.test.ts'],
      // Include only necessary files
      include: ['src/**/*.ts', 'src/**/*.d.ts', 'src/**/*.vue'],
    }),
  ],
  resolve: createBaseResolve(resolve(__dirname, '../..'), {
    '@courseware': resolve(__dirname, 'src'), // Override for self-imports during build
  }),
  // Add assetsInclude to explicitly handle SVG assets
  assetsInclude: ['**/*.svg'],
  build: {
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      keep_classnames: true, // required for some dynamic component loading mechanisms
    },
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        backend: resolve(__dirname, 'src/backend.ts'),
      },
      name: 'VueSkuilderCourseWare',
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'mjs' : 'cjs.js'}`,
    },
    rollupOptions: {
      external: ['vue', '@vue-skuilder/common', '@vue-skuilder/common-ui', '@vue-skuilder/db'],
      output: {
        globals: {
          vue: 'Vue',
          '@vue-skuilder/common': 'VueSkuilderCommon',
          '@vue-skuilder/common-ui': 'VueSkuilderCommonUI',
          '@vue-skuilder/db': 'VueSkuilderDB',
        },
        exports: 'named',
        // Ensure assets are handled properly in the build
        assetFileNames: 'assets/[name].[ext]',
        // For backend entry, disable code splitting to create self-contained files
        manualChunks: (id) => {
          if (id.includes('backend')) {
            return undefined; // Keep backend as single chunk
          }
        },
      },
    },
    // This is crucial for component libraries - allow CSS to be in chunks
    cssCodeSplit: true,
  },
});
