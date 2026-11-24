import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],

  format: ['cjs', 'esm'],
  // tsup's d.ts pass sets a baseUrl itself, deprecated in TS 6.
  dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
  sourcemap: true,
  clean: true,
  target: 'es2022',
  splitting: false,
  outDir: 'dist',
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.js' : '.mjs',
    };
  },
});
