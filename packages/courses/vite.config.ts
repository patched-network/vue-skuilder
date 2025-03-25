import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    vue(),
    dts({
      insertTypesEntry: true,
      // Exclude test files from type generation
      exclude: ['**/*.spec.ts', '**/*.test.ts'],
      // Include only necessary files
      include: ['src/**/*.ts', 'src/**/*.d.ts', 'src/**/*.vue'],
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
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs.js'}`,
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
      },
    },
    // This is crucial for component libraries - allow CSS to be in chunks
    cssCodeSplit: true,
  },
});
