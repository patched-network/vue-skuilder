import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/core/index.ts',
    'src/pouch/index.ts',
    'src/impl/couch/index.ts',
    'src/impl/static/index.ts',
    'src/util/packer/index.ts',
    'src/diagnostics/index.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  // Session records stamp the framework version (core/versionStamps.ts).
  define: { __SKUILDER_DB_VERSION__: JSON.stringify(version) },
  outExtension: ({ format }) => ({
    js: format === 'esm' ? '.mjs' : '.js',
  }),
});
