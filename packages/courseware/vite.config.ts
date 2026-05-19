import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { libInjectCss } from 'vite-plugin-lib-inject-css';
import { resolve } from 'path';
import { createBaseResolve } from '../../vite.config.base.js';

export default defineConfig({
  plugins: [
    vue({}),
    // Inject each chunk's extracted CSS as a JS side-effect import. Without
    // this, subcourses split into their own chunks (chess, piano, math, …)
    // ship CSS sidecars (e.g. dist/assets/chess.css) that consumers never
    // load — the chess board renders unstyled in prod. See
    // packages/courseware/src/index.ts for the dynamic subcourse loaders.
    libInjectCss(),
    dts({
      insertTypesEntry: true,
      // Exclude test files from type generation
      exclude: ['**/*.spec.ts', '**/*.test.ts'],
      // Include only necessary files
      include: ['src/**/*.ts', 'src/**/*.d.ts', 'src/**/*.vue'],
      // Keep external imports as package names instead of resolving to relative paths
      aliasesExclude: [/@vue-skuilder\/.*/],
    }),
  ],
  resolve: createBaseResolve(resolve(__dirname, '../..'), {
    '@courseware': resolve(__dirname, 'src'), // Override for self-imports during build
  }),
  // Add assetsInclude to explicitly handle SVG assets
  assetsInclude: ['**/*.svg'],
  build: {
    sourcemap: true,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        backend: resolve(__dirname, 'src/backend.ts'),
      },
      name: 'VueSkuilderCourseWare',
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'mjs' : 'cjs.js'}`,
    },
    rolldownOptions: {
      external: ['vue', '@vue-skuilder/common', '@vue-skuilder/common-ui', '@vue-skuilder/db', 'moment'],
      output: {
        globals: {
          vue: 'Vue',
          '@vue-skuilder/common': 'VueSkuilderCommon',
          '@vue-skuilder/common-ui': 'VueSkuilderCommonUI',
          '@vue-skuilder/db': 'VueSkuilderDB',
        },
        exports: 'named',
        keepNames: true,
        // Ensure assets are handled properly in the build
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    // This is crucial for component libraries - allow CSS to be in chunks
    cssCodeSplit: true,
  },
});
