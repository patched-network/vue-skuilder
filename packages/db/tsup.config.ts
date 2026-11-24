// The CommonJS bundle (Node and tests) and the types. The ESM build, one file
// per module, is rolldown.config.mjs.
//
// No `clean`: the two configs run in parallel, and rolldown writes into the
// same dist. The build script empties dist first.
import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';
import { entries } from './build.entries.mjs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig([
  {
    entry: entries,
    format: ['cjs'],
    dts: false,
    splitting: false,
    sourcemap: true,
    // Session records stamp the framework version (core/versionStamps.ts).
    define: { __SKUILDER_DB_VERSION__: JSON.stringify(version) },
    outExtension: () => ({ js: '.cjs' }),
  },
  // ESM-flavoured .d.ts, for both conditions (as before). SKUILDER_SKIP_DTS=1
  // skips it (the e2e CI jobs never read types).
  ...(process.env.SKUILDER_SKIP_DTS
    ? []
    : [
        {
          entry: entries,
          format: ['esm' as const],
          dts: {
            only: true,
            // tsup's d.ts bundler resolves the @db/* path alias only with a
            // baseUrl, which TS 7 removed from tsconfig.base.json. tsup runs on
            // TS 5.x, so the option stays valid here.
            compilerOptions: { baseUrl: '../..' },
          },
        },
      ]),
]);
