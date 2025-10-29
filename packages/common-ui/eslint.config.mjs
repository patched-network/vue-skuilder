import frontendConfig from '../../eslint.config.frontend.mjs';

export default [
  ...frontendConfig,
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'eslint.config.mjs', 'cypress/**', 'cypress.config.ts', 'vite.config.js', 'vitest.config.ts', 'vitest.setup.ts'],
  },
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
