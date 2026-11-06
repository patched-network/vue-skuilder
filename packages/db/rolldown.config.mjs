// packages/db/rolldown.config.mjs
//
// The ESM build: one output file per source module (preserveModules), so an
// app loads the modules it imports, and the dynamic import()s in factory.ts
// etc. stay separate chunks instead of being inlined into one bundle.
// "sideEffects" in package.json lists the modules that act on import.
//
// tsup (tsup.config.ts) builds the CommonJS bundle and the types.
//
// `@db/...` path aliases resolve through tsconfig.json's `paths`.

import { builtinModules } from 'node:module';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'rolldown';
import { entries } from './build.entries.mjs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

const packages = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
  ...builtinModules,
];
const isExternal = (id) =>
  id.startsWith('node:') || packages.some((name) => id === name || id.startsWith(`${name}/`));

export default defineConfig({
  input: entries,
  external: isExternal,
  tsconfig: 'tsconfig.json',
  transform: {
    // Session records stamp the framework version (core/versionStamps.ts).
    define: { __SKUILDER_DB_VERSION__: JSON.stringify(pkg.version) },
  },
  output: {
    dir: 'dist',
    format: 'es',
    sourcemap: true,
    keepNames: true,
    preserveModules: true,
    preserveModulesRoot: 'src',
    entryFileNames: '[name].mjs',
  },
});
