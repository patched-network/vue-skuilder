import frontendConfig from '../../eslint.config.frontend.mjs';

export default [
  ...frontendConfig,
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'eslint.config.mjs', 'vite.config.js', 'vitest.config.ts'],
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
