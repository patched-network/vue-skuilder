import backendConfig from '../../eslint.config.backend.mjs';

export default [
  ...backendConfig,
  {
    ignores: ['node_modules/**', 'dist/**', 'eslint.config.mjs'],
  },
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Database-specific rules
      '@typescript-eslint/no-explicit-any': 'off', // PouchDB types often use any
    },
  },
];