import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/core/index.ts',
    'src/pouch/index.ts',
    'src/impl/static/index.ts',
    'src/util/packer/index.ts'
  ],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outExtension: ({ format }) => ({
    js: format === 'esm' ? '.mjs' : '.js'
  })
});
