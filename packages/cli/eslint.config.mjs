import backendConfig from '../../eslint.config.backend.mjs';

export default [
  ...backendConfig,
  {
    ignores: ['node_modules/**', 'dist/**', 'eslint.config.mjs', 'tsconfig.json', 'testproject/**', 'cypress/**', 'cypress.config.js'],
  },
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // CLI-specific rules - CLI tools need console output
      'no-console': 'off',
      '@typescript-eslint/no-console': 'off',
    },
  },
];