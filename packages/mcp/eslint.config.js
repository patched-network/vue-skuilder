import backendConfig from '../../eslint.config.backend.mjs';

export default [
  ...backendConfig,
  {
    ignores: ['node_modules/**', 'dist/**', 'eslint.config.js', 'tsup.config.ts', 'src/examples/**'],
  },
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // Allow console statements in MCP server - they don't land anywhere visible anyway
      'no-console': 'off',
    },
  },
];
