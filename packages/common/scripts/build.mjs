// packages/common/scripts/build.mjs
//
// Builds dist/ as one file per source module, in two formats side by side:
//
//   x.mjs  (+ x.mjs.map)  ESM        <- tsconfig.esm.json
//   x.cjs  (+ x.cjs.map)  CommonJS   <- tsconfig.cjs.json
//   x.d.ts (+ x.d.ts.map) types, from the ESM pass
//
// The package is "type": "module", so CommonJS output must not be named .js:
// Node would load it as ESM and every relative require() would fail.
//
// tsc can't choose output extensions, so each pass compiles into a scratch
// directory and this script renames files and rewrites what points at them:
// relative import/require specifiers, sourceMappingURL comments, and each
// map's "file" field.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const scratch = { esm: join(root, 'dist-esm'), cjs: join(root, 'dist-cjs') };

for (const dir of [dist, scratch.esm, scratch.cjs]) rmSync(dir, { recursive: true, force: true });

const tsc = (...args) => execFileSync('npx', ['tsc', ...args], { cwd: root, stdio: 'inherit' });
tsc('-p', 'tsconfig.esm.json', '--outDir', scratch.esm);
tsc(
  '-p',
  'tsconfig.cjs.json',
  '--outDir',
  scratch.cjs,
  '--declaration',
  'false',
  '--declarationMap',
  'false'
);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

// Relative specifiers only: `from './x.js'`, `import './x.js'`,
// `import('./x.js')`, `require('./x.js')`.
const SPECIFIER = /((?:\bfrom|\bimport|\brequire)\s*\(?\s*)(['"])(\.\.?\/[^'"]*?)\.js\2/g;

function emit(dest, contents) {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, contents);
}

function convert(format, ext) {
  const from = scratch[format];
  for (const path of walk(from)) {
    const rel = relative(from, path);
    const out = (p) => join(dist, p);

    if (rel.endsWith('.js')) {
      const base = rel.slice(0, -'.js'.length);
      const name = base.split('/').pop();
      const code = readFileSync(path, 'utf8')
        .replace(SPECIFIER, `$1$2$3${ext}$2`)
        .replace(
          /\/\/# sourceMappingURL=.*\.js\.map\s*$/,
          `//# sourceMappingURL=${name}${ext}.map\n`
        );
      emit(out(base + ext), code);
    } else if (rel.endsWith('.js.map')) {
      const base = rel.slice(0, -'.js.map'.length);
      const map = JSON.parse(readFileSync(path, 'utf8'));
      map.file = base.split('/').pop() + ext;
      emit(out(base + ext + '.map'), JSON.stringify(map));
    } else if (format === 'esm') {
      // .d.ts and .d.ts.map: same relative depth as dist, so paths hold.
      emit(out(rel), readFileSync(path));
    }
  }
}

convert('esm', '.mjs');
convert('cjs', '.cjs');

for (const dir of Object.values(scratch)) rmSync(dir, { recursive: true, force: true });
