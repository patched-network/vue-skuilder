import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'path';

export default defineConfig({
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      keep_classnames: true,
    },
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VueSkuilderCommonUI',
      fileName: (format) => `common-ui.${format}.js`,
    },
    rollupOptions: {
      // External packages that shouldn't be bundled
      external: ['vue', 'vuetify'],
      output: {
        // Global variables to use in UMD build for externalized deps
        globals: {
          vue: 'Vue',
          vuetify: 'Vuetify',
        },
        // Preserve CSS in the output bundle
        assetFileNames: (assetInfo) => {
          return `assets/[name][extname]`;
        },
        sourcemap: true,
      },
    },
    // This is crucial for component libraries - allow CSS to be in chunks
    cssCodeSplit: true,
  },
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    extensions: ['.js', '.ts', '.json', '.vue'],
  },
});
