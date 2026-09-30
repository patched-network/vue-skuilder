// packages/common-ui/vite.config.js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { createBaseResolve } from '../../vite.config.base.js';
import { external, globals } from './vite.externals.js';

export default defineConfig({
  build: {
    target: 'es2020',
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VueSkuilderCommonUI',
      fileName: (format) => `common-ui.${format}.js`,
    },
    rolldownOptions: {
      // External packages that shouldn't be bundled
      external,
      output: {
        globals,
        keepNames: true,
        // Preserve CSS in the output bundlest
        assetFileNames: (assetInfo) => {
          return `assets/[name][extname]`;
        },
      },
    },
    // This is crucial for component libraries - allow CSS to be in chunks
    cssCodeSplit: true,
  },
  plugins: [
    vue(),
    dts({
      insertTypesEntry: true,
      // Keep sibling-package imports bare in the emitted .d.ts. Otherwise the
      // build aliases rewrite them to monorepo-relative dist paths (e.g.
      // '../../db/dist/diagnostics/index.mjs'), which have no .d.mts and
      // leave consumers with `any`.
      aliasesExclude: [/^@vue-skuilder\//],
      // Exclude test files from type generation
      exclude: ['**/*.spec.ts', '**/*.test.ts'],
      // Include only necessary files
      include: ['src/**/*.ts', 'src/**/*.d.ts', 'src/**/*.vue'],
    }),
  ],
  resolve: createBaseResolve(resolve(__dirname, '../..'), {
    '@cui': resolve(__dirname, 'src'), // Override for self-imports during build
  }),
});
