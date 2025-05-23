import backendConfig from '../../eslint.config.backend.mjs';

export default [
  ...backendConfig,
  {
    ignores: ['node_modules/**', 'dist/**', 'dist-esm/**', 'eslint.config.js'],
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