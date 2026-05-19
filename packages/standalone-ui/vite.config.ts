// packages/standalone-ui/vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { createBaseResolve } from '../../vite.config.base.js';

// Determine build mode from environment variable
const buildMode = process.env.BUILD_MODE || 'webapp';

export default defineConfig({
  plugins: [
    vue(),
    // Only include dts plugin for library builds
    ...(buildMode === 'library'
      ? [
          dts({
            insertTypesEntry: true,
            include: ['src/questions/**/*.ts', 'src/questions/**/*.vue'],
            exclude: ['**/*.spec.ts', '**/*.test.ts'],
            outDir: 'dist-lib',
          }),
        ]
      : []),
  ],
  resolve: createBaseResolve(resolve(__dirname, '../..'), {
    // Add events alias if needed (often required by dependencies)
    events: 'events',
    // Override for self-imports during library build
    ...(buildMode === 'library' && {
      '@sui': resolve(__dirname, 'src'),
    }),
  }),
  // --- Important for linked source dependencies ---
  optimizeDeps: {
    include: ['events'],
  },
  server: {
    port: 6173, // distinct from platform-ui
  },
  build:
    buildMode === 'library'
      ? {
          // Library build configuration
          sourcemap: true,
          target: 'es2020',
          lib: {
            entry: resolve(__dirname, 'src/questions/index.ts'),
            name: 'VueSkuilderStandaloneQuestions',
            fileName: (format) => `questions.${format === 'es' ? 'mjs' : 'cjs.js'}`,
          },
          rolldownOptions: {
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
              keepNames: true,
              // Emit the library as a single file. Vite >= 8 (rolldown) splits
              // library builds into multiple chunks (e.g. moment-<hash>.js,
              // MarkdownRenderer-<hash>.js) by default. The CLI studio command
              // serves questions.mjs from a different URL than the chunks live
              // at on disk, so relative chunk imports fail in the browser.
              // Inlining keeps everything in one file and sidesteps the
              // chunk-resolution problem entirely.
              inlineDynamicImports: true,
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
          rolldownOptions: {
            output: {
              keepNames: true,
            },
          },
          // Standard webapp output directory
          outDir: 'dist',
        },
  // Add define block if standalone-ui needs process polyfills (like platform-ui did)
  define: {
    global: 'window',
    'process.env': process.env,
    'process.browser': true,
    'process.version': JSON.stringify(process.version),
  },
});
