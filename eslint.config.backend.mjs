import tseslint from 'typescript-eslint';
import baseConfig from './eslint.config.base.mjs';

export default tseslint.config(...baseConfig, {
  languageOptions: {
    parserOptions: {
      project: true,
    },
  },
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off', // [ ] move back to warn eventually?
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
  },
});
