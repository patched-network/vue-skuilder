import { defineConfig } from 'vitest/config';
import path from 'path';

const { resolve } = path;

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,ts}', 'src/**/*.{test,spec}.{js,ts}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
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
      '@db': resolve(__dirname, 'src'),
    },
  },
});
