import backendConfig from '../../eslint.config.backend.mjs';

export default [
  ...backendConfig,
  {
    ignores: ['node_modules/**', 'userdb-*/**', 'eslint.config.mjs', 'vitest.config.ts'],
  },
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        // Vitest globals
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
      },
    },
    rules: {
      // Testing-specific rules
      '@typescript-eslint/no-explicit-any': 'off', // Tests often need any for mocking
      '@typescript-eslint/explicit-function-return-type': 'off', // Test functions don't need return types
      'no-var': 'off', // var is required in declare global blocks
      'no-console': 'off', // Tests can use console for debugging
      '@typescript-eslint/no-namespace': 'off', // Namespaces needed for custom matcher declarations
    },
  },
];