// packages/common-ui/vite.config.admin.js
//
// Second build for the `@vue-skuilder/common-ui/admin` entry: admin and
// diagnostics components, kept out of the main bundle that learners load.
// ES only (browser-side admin views). Runs after the main build, into
// dist/admin, without emptying dist. Types come from the main build's dts
// pass, which already covers src/admin.
//
// Admin code imports shared common-ui pieces from '@vue-skuilder/common-ui'
// (external here), never via '@cui/...', so they aren't duplicated.
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { createBaseResolve } from '../../vite.config.base.js';
import { external } from './vite.externals.js';

export default defineConfig({
  build: {
    target: 'es2020',
    sourcemap: true,
    outDir: 'dist/admin',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/admin/index.ts'),
      formats: ['es'],
      fileName: () => 'common-ui-admin.es.js',
      cssFileName: 'admin',
    },
    rolldownOptions: {
      external: [...external, '@vue-skuilder/common-ui', '@vue-skuilder/db/diagnostics'],
      output: {
        keepNames: true,
      },
    },
  },
  plugins: [vue()],
  resolve: createBaseResolve(resolve(__dirname, '../..'), {
    '@cui': resolve(__dirname, 'src'),
  }),
});
