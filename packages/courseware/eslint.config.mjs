import frontendConfig from '../../eslint.config.frontend.mjs';

export default [
  ...frontendConfig,
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'eslint.config.mjs',
      'vite.config.js',
      'vite.config.ts',
      'vitest.config.ts',
      'src/logic.js',
      'src/logic.d.ts',
      'src/word-work/ankiCardGen/ankiCardGen.js',
    ],
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
