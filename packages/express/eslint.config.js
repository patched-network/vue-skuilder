import backendConfig from '../../eslint.config.backend.mjs';

export default [
  ...backendConfig,
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'eslint.config.js', 'assets/**', 'babel.config.js', 'vitest.config.ts', 'test/**'],
  },
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Express-specific rules (backend config already includes most needed rules)
    },
  },
];