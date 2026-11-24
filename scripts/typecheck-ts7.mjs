// Type-checks the non-Vue packages with TypeScript 7 (installed as the
// `typescript-7` alias; `tsc` on PATH is still 5.x for the Vue tooling).
// Keeps their tsconfigs valid for TS 7 until the whole workspace can move.
//
// Needs the libs built first (cli resolves express/mcp types from dist).
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const tsc7 = join(dirname(require.resolve('typescript-7/package.json')), 'bin', 'tsc');

const configs = [
  'packages/common/tsconfig.json',
  'packages/common/tsconfig.cjs.json',
  'packages/db/tsconfig.json',
  'packages/express/tsconfig.json',
  'packages/mcp/tsconfig.json',
  'packages/cli/tsconfig.json',
  'packages/tuilder/tsconfig.json',
  'packages/client/tsconfig.json',
];

let failed = 0;
for (const config of configs) {
  const start = Date.now();
  try {
    execFileSync(process.execPath, [tsc7, '-p', config, '--noEmit'], {
      cwd: root,
      stdio: 'inherit',
    });
    console.log(`[typecheck-ts7] ok   ${config} (${Date.now() - start}ms)`);
  } catch {
    failed++;
    console.log(`[typecheck-ts7] FAIL ${config}`);
  }
}
process.exit(failed ? 1 : 0);
