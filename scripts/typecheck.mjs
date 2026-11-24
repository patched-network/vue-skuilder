// Type-checks every package and compares the errors against a committed
// baseline (typecheck-baseline.json), so CI fails on any *new* type error while
// the existing backlog is burned down.
//
//   yarn typecheck                 check; fail on new errors or a stale baseline
//   yarn typecheck --update        rewrite the baseline from the current errors
//   yarn typecheck --only edit-ui  check some packages (comma-separated)
//
// Errors are keyed by file + error code (not line), counted per check. A new
// key, or a higher count for an existing one, fails. A lower count also fails
// until the baseline is updated, so fixed errors can't quietly come back.
//
// Non-Vue packages are checked with TypeScript 7 (the `typescript-7` alias;
// ~10x faster, and they are at zero errors); Vue packages with vue-tsc (TS 6).
// Needs the libs built with types first: packages resolve each other via dist.

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { availableParallelism } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const tsc7 = join(dirname(require.resolve('typescript-7/package.json')), 'bin', 'tsc');
const vueTsc = join(root, 'node_modules', '.bin', 'vue-tsc');
const baselinePath = join(root, 'typecheck-baseline.json');

// id, package dir, tsconfig, checker
const checks = [
  ['common', 'common', 'tsconfig.json', 'ts7'],
  ['common:cjs', 'common', 'tsconfig.cjs.json', 'ts7'],
  ['db', 'db', 'tsconfig.json', 'ts7'],
  ['express', 'express', 'tsconfig.json', 'ts7'],
  ['mcp', 'mcp', 'tsconfig.json', 'ts7'],
  ['cli', 'cli', 'tsconfig.json', 'ts7'],
  ['tuilder', 'tuilder', 'tsconfig.json', 'ts7'],
  ['client', 'client', 'tsconfig.json', 'ts7'],
  ['e2e-testing', 'e2e-testing', 'tsconfig.json', 'ts7'],
  ['common-ui', 'common-ui', 'tsconfig.json', 'vue'],
  ['courseware', 'courseware', 'tsconfig.json', 'vue'],
  ['edit-ui', 'edit-ui', 'tsconfig.json', 'vue'],
  ['platform-ui', 'platform-ui', 'tsconfig.json', 'vue'],
  ['standalone-ui', 'standalone-ui', 'tsconfig.json', 'vue'],
  ['studio-ui', 'studio-ui', 'tsconfig.json', 'vue'],
];

const args = process.argv.slice(2);
const update = args.includes('--update');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(',')) : null;
const selected = checks.filter(([id, dir]) => !only || only.has(id) || only.has(dir));

const ERROR = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
const GLOBAL_ERROR = /^error (TS\d+): (.*)$/;

function run([id, dir, project, tool]) {
  const cwd = join(root, 'packages', dir);
  const [cmd, cmdArgs] =
    tool === 'ts7'
      ? [process.execPath, [tsc7, '-p', project, '--noEmit', '--pretty', 'false']]
      : [vueTsc, ['-p', project, '--noEmit', '--pretty', 'false']];
  const start = Date.now();
  return new Promise((done) => {
    const child = spawn(cmd, cmdArgs, { cwd });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => {
      const errors = [];
      for (const line of out.split('\n')) {
        const m = line.match(ERROR);
        if (m) {
          const file = relative(root, resolve(cwd, m[1]));
          errors.push({
            key: `${file} ${m[4]}`,
            text: `${file}(${m[2]},${m[3]}): ${m[4]} ${m[5]}`,
          });
          continue;
        }
        const g = line.match(GLOBAL_ERROR);
        if (g) errors.push({ key: `<global> ${g[1]}`, text: `${g[1]} ${g[2]}` });
      }
      // A non-zero exit with nothing parsed means the checker itself broke.
      // A global error (bad config, missing type library) means it stopped
      // before checking any file, so it can't be baselined either.
      const crashed =
        (code !== 0 && errors.length === 0) || errors.some((e) => e.key.startsWith('<global>'));
      done({ id, errors, crashed, output: out, ms: Date.now() - start });
    });
  });
}

async function runAll() {
  const queue = [...selected];
  const results = [];
  const workers = Array.from(
    { length: Math.min(availableParallelism(), queue.length) },
    async () => {
      while (queue.length) results.push(await run(queue.shift()));
    }
  );
  await Promise.all(workers);
  return results.sort(
    (a, b) => checks.findIndex((c) => c[0] === a.id) - checks.findIndex((c) => c[0] === b.id)
  );
}

function counts(errors) {
  const c = {};
  for (const { key } of errors) c[key] = (c[key] ?? 0) + 1;
  return Object.fromEntries(Object.entries(c).sort(([a], [b]) => a.localeCompare(b)));
}

let baseline = {};
try {
  baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
} catch {
  // no baseline yet
}

const results = await runAll();
let failed = false;

for (const r of results) {
  if (r.crashed) {
    failed = true;
    console.log(`[typecheck] CRASH ${r.id}: the checker did not check (crash or config error)`);
    console.log(r.output.split('\n').slice(-15).join('\n'));
  }
}

if (update) {
  const next = { ...baseline };
  for (const r of results) {
    if (r.crashed) continue;
    const c = counts(r.errors);
    if (Object.keys(c).length) next[r.id] = c;
    else delete next[r.id];
  }
  const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(baselinePath, JSON.stringify(sorted, null, 2) + '\n');
  for (const r of results)
    console.log(`[typecheck] ${r.id}: ${r.errors.length} errors (${r.ms}ms)`);
  console.log(`[typecheck] baseline written: ${relative(root, baselinePath)}`);
  process.exit(failed ? 1 : 0);
}

for (const r of results) {
  if (r.crashed) continue;
  const base = baseline[r.id] ?? {};
  const cur = counts(r.errors);
  const added = Object.keys(cur).filter((k) => cur[k] > (base[k] ?? 0));
  const fixed = Object.keys(base).filter((k) => (cur[k] ?? 0) < base[k]);
  const total = Object.values(base).reduce((a, b) => a + b, 0);
  let status = 'ok  ';
  if (added.length) status = 'NEW ';
  else if (fixed.length) status = 'STALE';
  console.log(
    `[typecheck] ${status} ${r.id}: ${r.errors.length} errors, baseline ${total} (${r.ms}ms)`
  );
  if (added.length) {
    failed = true;
    for (const k of added) {
      console.log(`    new: ${k} (${cur[k]} now, ${base[k] ?? 0} in baseline)`);
      for (const e of r.errors.filter((e) => e.key === k)) console.log(`      ${e.text}`);
    }
  }
  if (fixed.length) {
    failed = true;
    for (const k of fixed)
      console.log(`    fixed: ${k} (${cur[k] ?? 0} now, ${base[k]} in baseline)`);
  }
}

if (failed) {
  console.log('\n[typecheck] FAILED.');
  console.log('  New errors: fix them (the baseline only covers errors that already existed).');
  console.log('  Fixed errors: run `yarn typecheck --update` and commit typecheck-baseline.json.');
}
process.exit(failed ? 1 : 0);
