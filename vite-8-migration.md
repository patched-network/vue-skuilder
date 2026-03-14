# Vite 8 Migration

Done (branch `vite-8-prep-1` / `vite-8-prep-2`):

- `vitest` bumped to `^4.1.0` across all packages
- `@vitejs/plugin-vue` bumped to `^6.0.5` across all packages
- `vite-plugin-eslint` removed from `platform-ui` (dead package, last release 2022)
- `vite` bumped to `^8.0.0` across all packages
- `edit-ui`: removed stray `sourcemap: true` key from `globals` object (exposed by Rolldown's stricter validation)
- `studio-ui`: converted `manualChunks` from object form (removed in v8) to function form

All packages building locally. CI at parity with pre-migration baseline. Remaining items below
are deprecation cleanup (warnings only, not blocking).

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
