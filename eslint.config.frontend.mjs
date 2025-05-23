import tseslint from 'typescript-eslint';
import baseConfig from './eslint.config.base.mjs';

export default tseslint.config(
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console': 'off', // Allow console in frontend for debugging
    },
  }
);