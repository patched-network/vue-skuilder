# Vite 8 Migration

Done (branch `vite-8-prep-1` / `vite-8-prep-2`):

- `vitest` bumped to `^4.1.0` across all packages
- `@vitejs/plugin-vue` bumped to `^6.0.5` across all packages
- `vite-plugin-eslint` removed from `platform-ui` (dead package, last release 2022)
- `vite` bumped to `^8.0.0` across all packages
- `edit-ui`: removed stray `sourcemap: true` key from `globals` object (exposed by Rolldown's stricter validation)
- `studio-ui`: converted `manualChunks` from object form (removed in v8) to function form

All packages building locally. Remaining deprecation cleanup below (warnings only, not blocking).

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

## 3. Terser (resolved via hoisting — optional cleanup)

In practice, `minify: 'terser'` works across all packages because `terser` is hoisted from
`platform-ui`'s devDeps in the monorepo. No breakage observed.

Long-term, migrating to Rolldown-native minification would be cleaner:

```js
build: {
  rolldownOptions: {
    output: {
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
- `common-ui` uses Cypress component testing, which is blocked on cypress#33078 (Cypress 15.x
  bundles `@cypress/vite-dev-server` requiring vite <=7). CI pins vite back to v7 for that step
  only. Remove the pin step in `ci-pkg-common-ui.yml` once Cypress ships Vite 8 support.

---

Note vite config templating for CLI-generated/scaffolded configs — these embed vite config as
strings in source and need the same treatment as the package configs:

- `packages/cli/src/utils/template.ts` — scaffolded standalone course vite config
- `packages/cli/src/commands/studio.ts` (`createStudioViteConfig`) — studio build vite config
  (already fixed: `manualChunks` object form → function form)
