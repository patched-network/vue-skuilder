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
        // Prevent code splitting
        manualChunks: undefined,
        inlineDynamicImports: true,
        // Ensure CSS is properly handled
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'style.css';
          return assetInfo.name;
        },
      },
    },
    // Prevent code splitting
    cssCodeSplit: false,
  },
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    extensions: ['.js', '.ts', '.json', '.vue'],
  },
});
