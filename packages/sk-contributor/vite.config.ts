import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { fileURLToPath, URL } from 'node:url';

// Determine build mode from environment variable
const buildMode = process.env.BUILD_MODE || 'webapp';

export default defineConfig({
  plugins: [
    vue(),
    // Only include dts plugin for library builds
    ...(buildMode === 'library'
      ? [dts({
          insertTypesEntry: true,
          include: ['src/questions/**/*.ts', 'src/questions/**/*.vue'],
          exclude: ['**/*.spec.ts', '**/*.test.ts'],
          outDir: 'dist-lib',
        })]
      : []
    )
  ],
  resolve: {
    alias: {
      // Alias for internal src paths
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Add events alias if needed (often required by dependencies)
      events: 'events',
    },
    extensions: ['.js', '.ts', '.json', '.vue'],
    dedupe: [
      // Ensure single instances of core libs and published packages
      'vue',
      'vuetify',
      'pinia',
      'vue-router',
      '@vue-skuilder/db',
      '@vue-skuilder/common',
      '@vue-skuilder/common-ui',
      '@vue-skuilder/courseware',
    ],
  },
  // --- Dependencies optimization ---
  optimizeDeps: {
    include: [
      'events',
      '@vue-skuilder/common-ui',
      '@vue-skuilder/db',
      '@vue-skuilder/common',
      '@vue-skuilder/courseware',
    ],
  },
  server: {
    port: 5173, // Use standard Vite port for standalone projects
  },
  build: buildMode === 'library'
    ? {
        // Library build configuration
        sourcemap: true,
        target: 'es2020',
        minify: 'terser',
        terserOptions: {
          keep_classnames: true,
        },
        lib: {
          entry: resolve(__dirname, 'src/questions/index.ts'),
          name: 'VueSkuilderStandaloneQuestions',
          fileName: (format) => `questions.${format === 'es' ? 'mjs' : 'cjs.js'}`,
        },
        rollupOptions: {
          // External packages that shouldn't be bundled in library mode
          // For studio integration, we bundle vue-skuilder packages to avoid npm resolution issues
          external: [
            // Bundle everything for studio integration - no externals
          ],
          output: {
            // Global variables for UMD build
            globals: {
              vue: 'Vue',
              'vue-router': 'VueRouter',
              vuetify: 'Vuetify',
              pinia: 'Pinia',
              // Remove globals for bundled packages
              // '@vue-skuilder/common': 'VueSkuilderCommon',
              // '@vue-skuilder/common-ui': 'VueSkuilderCommonUI',
              // '@vue-skuilder/courseware': 'VueSkuilderCourseWare',
              // '@vue-skuilder/db': 'VueSkuilderDB',
            },
            exports: 'named',
            // Preserve CSS in the output bundle
            assetFileNames: 'assets/[name].[ext]',
          },
        },
        // Output to separate directory for library build
        outDir: 'dist-lib',
        // Allow CSS code splitting for component libraries
        cssCodeSplit: true,
      }
    : {
        // Webapp build configuration (existing)
        sourcemap: true,
        target: 'es2020',
        minify: 'terser',
        terserOptions: {
          keep_classnames: true,
        },
        // Standard webapp output directory
        outDir: 'dist',
      },
  // Add define block for process polyfills
  define: {
    global: 'window',
    'process.env': process.env,
    'process.browser': true,
    'process.version': JSON.stringify(process.version),
  },
});
