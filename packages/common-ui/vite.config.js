// packages/common-ui/vite.config.js
//
// ES only, one output file per source module (preserveModules), so an app
// that imports a few things from common-ui loads only those modules and what
// they import. "sideEffects": false in package.json lets the app's bundler
// drop the rest.
//
// CSS is one stylesheet, dist/assets/index.css (the `./style` export), never
// imported from JS: under "sideEffects": false a consumer would drop a
// module's `import './x.css'`.
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { createBaseResolve } from '../../vite.config.base.js';
import { externals } from './vite.externals.js';

export default defineConfig({
  build: {
    target: 'es2020',
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      cssFileName: 'index',
    },
    rolldownOptions: {
      external: externals(),
      output: {
        keepNames: true,
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].mjs',
        assetFileNames: 'assets/[name][extname]',
      },
    },
    cssCodeSplit: false,
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
