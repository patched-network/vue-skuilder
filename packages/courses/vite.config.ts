import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    vue(),
    dts({
      insertTypesEntry: true,
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // Add assetsInclude to explicitly handle SVG assets
  assetsInclude: ['**/*.svg'],
  build: {
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      keep_classnames: true, // required for some dynamic component loading mechanisms
    },
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VueSkuilderCourses',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'js'}`,
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
      },
    },
  },
});
