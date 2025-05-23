import tseslint from 'typescript-eslint';
import baseConfig from './eslint.config.base.js';

export default tseslint.config(
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        project: true,
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  }
);