// Runs the given command unless SKUILDER_SKIP_DTS is set. For package scripts
// whose only remaining step is type output, e.g.
//   "build": "vite build && node ../../scripts/unless-skip-dts.mjs yarn build-types"
import { spawnSync } from 'node:child_process';

if (process.env.SKUILDER_SKIP_DTS) {
  console.log(`[skip-dts] SKUILDER_SKIP_DTS set; skipping: ${process.argv.slice(2).join(' ')}`);
  process.exit(0);
}
const [cmd, ...args] = process.argv.slice(2);
const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
