// Dependencies common-ui's builds leave as bare imports. Shared by the main
// build (vite.config.js) and the admin entry (vite.config.admin.js).
//
// Everything in dependencies and peerDependencies, and their subpaths. Nothing
// is bundled: a bundled dependency would land in dist/node_modules under
// preserveModules, which `yarn npm publish` leaves out, and would be a second
// copy for any app that also uses it.

import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

const packages = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
];

/** @param {string[]} extra further packages to keep external */
export function externals(extra = []) {
  const names = [...packages, ...extra];
  return (id) => names.some((name) => id === name || id.startsWith(`${name}/`));
}
