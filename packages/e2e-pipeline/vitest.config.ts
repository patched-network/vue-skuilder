import { defineConfig } from 'vitest/config';
import path from 'path';

const { resolve } = path;

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ['./tests/vitest-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.d.ts',
        '**/vitest.config.ts',
        '**/tests/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@harness': resolve(__dirname, 'src/harness'),
      '@fixtures': resolve(__dirname, 'src/fixtures'),
      '@mocks': resolve(__dirname, 'src/mocks'),
    },
  },
});