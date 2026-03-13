# Vite 8 Migration

Pre-work already done on branch `vite-8-prep-1`:

- `vitest` bumped to `^4.1.0` across all packages
- `@vitejs/plugin-vue` bumped to `^6.0.5` across all packages
- `vite-plugin-eslint` removed from `platform-ui` (dead package, last release 2022)

Vite bumped to `^8.0.0` in all packages **except `common-ui`** (pinned at `^7.0.0` — see blocker
below).

---

## 1. `build.rollupOptions` → `build.rolldownOptions`

Deprecated in Vite 8. Rename in each affected config.

- `packages/courseware/vite.config.ts`
- `packages/common-ui/vite.config.js`
- `packages/edit-ui/vite.config.js`
- `packages/standalone-ui/vite.config.ts`

---

## 2. Remove trivial `manualChunks` in courseware

`packages/courseware/vite.config.ts:52` has a `manualChunks` function that always returns
`undefined`. The function form is deprecated in Vite 8. Just delete it.

---

## 3. Terser is no longer built-in

Every package uses `minify: 'terser'` with `keep_classnames: true`. Terser is no longer bundled
with Vite 8 — it must be an explicit `devDependency` or replaced.

**Option A** — keep Terser, add it explicitly. `platform-ui` already has `terser` in devDeps;
the others (`common-ui`, `courseware`, `edit-ui`, `standalone-ui`) do not.

**Option B** — migrate to Rolldown-native minification (recommended long-term):

```js
build: {
  minify: true, // uses Oxc minifier
  rolldownOptions: {
    output: {
      minify: { compress: true, mangle: true },
      keepNames: true, // replaces keep_classnames
    },
  },
}
```

`keep_classnames` is load-bearing for dynamic component loading — verify `keepNames` covers the
same behavior before dropping Terser.

---

## 4. `define: { 'process.env': process.env }` object reference behavior

`platform-ui/vite.config.js` and `standalone-ui/vite.config.ts` pass the full `process.env`
object via `define`. Vite 8 / Oxc no longer shares object references — each usage gets a separate
copy. Likely fine in practice but verify env vars are read correctly in production builds after
the upgrade.

---

## Notes

- No `optimizeDeps.esbuildOptions` usage — nothing to migrate there.
- No `esbuild` transform option in any config.
- CJS interop change: library packages externalize Vue etc., so the new default interop behavior
  should not affect them.
- **Blocker: `common-ui` pinned at Vite 7.** `common-ui` uses Cypress component testing, and
  Cypress does not yet support Vite 8 (cypress#33078, opened 2025-12-08, assigned, fix in
  progress). Bump `common-ui` to `^8.0.0` once a Cypress release ships with Vite 8 support.

---

Note vite config templating here for packages/cli scaffolded courses:

/home/colin/pn/vue-skuilder/master/packages/cli/src/utils/template.ts
