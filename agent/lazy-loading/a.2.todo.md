# Module-granular package builds: TODO

> **Date**: 2026-11-04
> **From**: LettersPractice's landing-page performance work (the `perf-boot`
> branch in the letterspractice repo; its `agent/perf-boot/a.3.framework-tree-shaking.md`
> has the prototype and its measurements).
> **Supersedes**: [a.1](a.1.assessment.md)'s T2.1 for `db` (see below). The rest
> of a.1 is the broader picture; this is the slice an app consuming the
> published packages needs first.

## Why

An app that takes a handful of things from `@vue-skuilder/common-ui` gets all
of it. LP's boot imports five (`useAuthStore`, `useConfigStore`, `piniaPlugin`,
`SnackbarService`, `SkMouseTrap`). The ES build is two files
(`dist/common-ui.es.js` statically importing a ~157 KB `MarkdownRenderer-*.mjs`
chunk), both importing moment, vuedraggable, vue-tags-input, marked, … at the
top. `"sideEffects": false` is already in its package.json; the build's shape
defeats it.

What it costs LP's landing page (one 4×-CPU profile; trust the shares):

- **CPU:** vuedraggable + sortablejs ~300 ms, common-ui's own evaluation
  ~190 ms, and its bundled copy of marked, of a 2.8 s entry evaluation. About a
  fifth. (vuedraggable's UMD wrapper finds its script by throwing an Error and
  reading the stack.)
- **Bytes:** a per-module prototype took LP's boot JS from 528 to 423 KB gzip
  (−103 KB); common-ui itself shrank to ~15 KB of LP's entry.

Every app on the framework pays the same.

## 1. `common`: `"sideEffects": false`

- [x] Add it to `packages/common/package.json`. `common` is compiled file by file
  with tsc (not bundled), and its source does nothing on import (checked).
- [x] Found on the way (same branch): `common`'s and `db`'s CommonJS builds were
  `.js` in `"type": "module"` packages, so Node loaded them as ESM: `require`
  of `common` threw, `require` of `db` returned `{}`. Now `.cjs`. `common`'s
  build moved to `scripts/build.mjs`, which also fixes sourcemaps (the ESM
  pass's maps overwrote the CJS pass's). `createFileLogger` used a bare
  `require('fs')` and silently wrote nothing from ESM (the CLI's MCP debug
  log); now `process.getBuiltinModule`.
- [ ] In LP, measure whether zod (~85 KB raw with zod-to-json-schema) leaves the
  boot; only db's `courseConfigRegistration` uses it.

## 2. `common-ui`: one output file per source module

Prototype config (Vite 8 / Rolldown), on top of the package's own:

```js
build: {
  lib: { ...base.build.lib, formats: ["es"], fileName: () => "index.js" },
  rolldownOptions: {
    output: { preserveModules: true, preserveModulesRoot: "src", entryFileNames: "[name].js" },
  },
},
```

That builds in ~3 s to 108 JS files, but as is it has two defects:

- [ ] **The stylesheet disappears.** With `preserveModules` and
  `cssCodeSplit: true` the build writes 26 per-component CSS files and no
  `dist/assets/index.css`; nothing imports them and `./style` points at a file
  that no longer exists. Build one stylesheet at the same path
  (`cssCodeSplit: false`; it's ~10 KB). Keep CSS out of the JS modules: with
  `"sideEffects": false`, a consumer drops `import "./x.css"`.
- [ ] **Bundled dependencies land in `dist/node_modules/`** (marked,
  highlight.js, mousetrap, canvas-confetti, the highlight.js Vue plugin), and
  `yarn npm publish` leaves nested `node_modules` out (`yarn pack --dry-run`
  shows it): the release would ship broken imports. Make every dependency
  external.
- [ ] Declare `canvas-confetti` in `dependencies`:
  `src/components/StudySession.vue:113` imports it, and it only works today
  because it's bundled.
- [ ] Drop the UMD build (`main`, `exports["."].require`): nothing in the repo
  uses it, and it can't preserve modules.
- [ ] Point `exports["."].import` / `module` at the new entry, and the production
  alias in [vite.config.base.js](../../vite.config.base.js) (line 47, currently
  `dist/common-ui.es.js`).
- [ ] Types as now.
- [ ] Update [CLAUDE.md](../../CLAUDE.md): it describes common-ui as a "UMD/ES"
  library build with CSS code splitting.
- [ ] `"sideEffects": false` stays correct: no module does anything on import
  that a consumer relies on (the one top-level call, `hljs.registerLanguage`,
  matters only to the module making it). Re-check if that changes.

**A bug in the published 0.2.35 this also fixes:**
`dist/assets/MarkdownRenderer.css` (the fill-in input's `UserInputString`
styles, the code-highlighting theme, AudioAutoPlayer's `.playing` pulse) is not
in `index.css`, not exported, and nothing loads it. Dev builds are fine;
production builds against `dist` lack those styles. Worth a look before and
after: a fill-in-the-blank card and a code block in a production build. (LP
renders neither, so it's never seen it.)

**Before release:**
- [ ] `yarn pack --dry-run`: the file list has every module and the stylesheet.
- [ ] Production builds of platform-ui and standalone-ui, a fill-in card and a
  code block checked in each.
- [ ] LP builds against the release (its side is ready: no
  `await import("@vue-skuilder/common-ui")` of the barrel, which would load all
  of it as one chunk; courseware loaded lazily and destructured in its own
  `.then`).

## 3. `db`: lazy `BaseUser`, an ESM build that keeps modules, a real `sideEffects` list

Its payoff for LP depends on LP mounting before the data layer (LP's own
follow-up), so this can come after 1–2.

- [ ] `src/factory.ts:4` imports `BaseUser` statically; it's used only at line
  106, inside the couch branch, where lines 91, 101 and 120 already use
  `await import(...)`. Make it lazy too. The static import pulls moment (via
  BaseUserDB) and PouchDB (via userDBHelpers → pouchdb-setup) back in.
  Measured with esbuild from LP's two boot imports (`initializeDataLayer`,
  `getDataLayer`), lazy imports as separate chunks: always loaded at boot,
  168 of 220 KB as is (PouchDB ×3, moment, uuid, cross-fetch, common); 32 KB
  with `BaseUser` lazy.
- [ ] An ESM build that keeps modules. Today's single-file tsup build
  (`splitting: false`) undoes those lazy imports anyway. tsup's unbundled mode
  leaves the `@db/` path aliases unresolved (31 files use them), so Rolldown
  with `preserveModules`, as for common-ui. The CommonJS build can stay one
  bundle (Node and tests only).
- [ ] `sideEffects` as a list, **not `false`** (a.1's T2.1 proposed `false`,
  which would break things). Modules that act on import:
  - `src/impl/couch/pouchdb-setup.ts` (registers PouchDB plugins)
  - `src/impl/couch/index.ts`: line 22 sets the `window.process` shim PouchDB
    needs (#18); line 28 opens `localUserDB`. Move the shim into
    `pouchdb-setup.ts`, so it can't be dropped while PouchDB is in use.
  - six console tools that mount themselves on `window.skuilder.*`:
    `study/SessionDebugger.ts:461`, `study/MixerDebugger.ts:555`,
    `core/UserDBDebugger.ts:472`, `core/navigators/PipelineDebugger.ts:1352`,
    `core/navigators/filters/eloDistance.ts:171`, `util/logger.ts:153`.
    Listed only `pouchdb-setup`, these silently vanish from apps that don't
    import them.
- [ ] **Decision (Colin):** the debug tools: list them in `sideEffects` (today's
  behaviour, ~40 KB of debugger at boot) or have apps call an explicit mount.

## 4. Release

- [ ] Release; bump `common`, `common-ui`, `courseware`, `db` in LP; drop LP's
  scratch alias if one is still around.
