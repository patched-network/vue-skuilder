# Lazy Loading & Tree-Shaking Assessment

> **Date**: 2025-02-18
> **Branch**: lazy-loading audit
> **Scope**: Full monorepo bundle analysis — courseware, common-ui, edit-ui, platform-ui, standalone-ui

---

## Current State

### Bundle Sizes (from latest dist artifacts)

| Package | Dist Size | Gzipped | Notes |
|---------|-----------|---------|-------|
| **platform-ui** JS | **4.1 MB** | **1.2 MB** | Single chunk. Zero code splitting. |
| platform-ui CSS | 818 KB | — | Also single chunk |
| courseware | 1.1 MB | 340 KB | Bundles paper, chess.js, abcjs, lodash, webmidi, tonal, chessground |
| edit-ui | 1.3 MB | — | Bundles entire courseware inside (not externalized) |
| common-ui | 231 KB | — | Bundles highlight.js, marked, mousetrap |

### Heavy Third-Party Dependencies in the Bundle Graph

| Dependency | Min Size | Used By | Actually Needed At Startup? |
|------------|----------|---------|---------------------------|
| abcjs | ~473 KB | `MusicScoreRender.vue` → sightsing only | No |
| paper.js | ~234 KB | `supplementaryAngles.vue` (1 view in math) | No |
| lodash (full) | ~73 KB | fillIn, angleCategorize, pitch, math/utility | Partially (fillIn is base type) |
| chess.js | ~72 KB | chess course only | No |
| moment | ~59 KB | piano views, common-ui (HeatMap, CardHistoryViewer, CompositionViewable), common, db | Partially |
| highlight.js (subset) | ~40 KB est. | `CodeBlockRenderer.vue` in common-ui | No |
| chessground (vendored) | ~30 KB est. | chess course only | No |
| webmidi | ~20 KB est. | piano MIDI utilities only | No |
| @tonaljs/tonal | small | piano MIDI utilities only | No |
| vue-tags-input | ~15 KB est. | `TagsInput.vue` in common-ui | No |

---

## Issues Found

### Issue 1: Courseware Barrel Eagerly Imports All Courses (Critical)

**File**: `packages/courseware/src/index.ts`

The barrel file eagerly imports all 9 course domains at the top level:

```
import chess from './chess';
import french from './french';
import math from './math';
import piano from './piano';
import pitch from './pitch';
import sightSing from './sightsing';
import typing from './typing';
import wordWork from './word-work';
import defaultCourse from './default';
```

Then immediately constructs a module-level singleton:

```
export const allCourseWare: AllCourseWare = new AllCourseWare([
  math, wordWork, french, defaultCourse, piano, pitch, sightSing, chess, typing,
]);
```

**Why this defeats tree-shaking**: Each course `index.ts` calls `new CourseWare(name, [...])` — a constructor with side effects (it calls `getBaseQTypes()` which always imports `BlanksCard` from `default/questions/fillIn`). Rollup cannot prove these imports are side-effect-free, so it includes everything.

**Impact**: Any consumer that touches `@vue-skuilder/courseware` — even for a single type re-export — pulls in **all** courses and **all** their heavy dependencies (paper.js, chess.js, abcjs, webmidi, tonal, chessground, lodash, moment).

**No `sideEffects` field**: None of the `package.json` files in the monorepo declare `"sideEffects"`, which means bundlers conservatively assume all modules have side effects.

### Issue 2: Platform-UI Has Zero Route-Level Code Splitting (Critical)

**File**: `packages/platform-ui/src/router.ts`

Every single view and component is eagerly imported at the top of the router:

```
import ClassroomCtrlPanel from './components/Classrooms/ClassroomCtrlPanel.vue';
import JoinCode from './components/Classrooms/JoinCode.vue';
import CourseRouter from './components/Courses/CourseRouter.vue';
import ELOModerator from './components/Courses/EloModeration.vue';
import TagInformation from './components/Courses/TagInformation.vue';
import { CourseEditor } from '@vue-skuilder/edit-ui';
import Stats from './components/User/UserStats.vue';
import About from './views/About.vue';
import AdminDashboard from './views/AdminDashboard.vue';
import Classrooms from './views/Classrooms.vue';
import Courses from './views/Courses.vue';
import Home from './views/Home.vue';
import Login from './views/Login.vue';
// ... etc
import Study from './views/Study.vue';
```

**Result**: The entire application compiles into a **single 4.1 MB JS chunk**. A user visiting `/login` downloads all of chess, piano MIDI, paper.js geometry, abcjs music notation, etc.

**Note**: `main.ts` already uses `await import('@vue-skuilder/courseware')` — good instinct — but since the courseware barrel is monolithic, this only defers parse time slightly. It does not split the bundle.

### Issue 3: edit-ui Bundles Courseware Internally (High)

**File**: `packages/edit-ui/vite.config.js`

edit-ui's rollupOptions externalizes `vue`, `vuetify`, `pinia`, `@vue-skuilder/db`, `@vue-skuilder/common`, `@vue-skuilder/common-ui` — but **not** `@vue-skuilder/courseware`.

Five files in edit-ui import from courseware:
- `BulkImportView.vue` → `BlanksCardDataShapes`, `allCourseWare`
- `ComponentRegistration.vue` → `allCourseWare`
- `CourseEditor.vue` → `allCourseWare`, `BlanksCard`, `BlanksCardDataShapes`
- `DataInputForm.vue` → `allCourseWare`, `AllCourseWare`
- `MidiInput.vue` → `SkMidi`, `eventsToSyllableSequence`, `SyllableSequence`, `transposeSyllableSeq`, `SyllableSeqVis`

**Result**: The **entire** courseware package (1.1 MB) is bundled inside edit-ui's dist (1.3 MB). When platform-ui then imports edit-ui, it gets a second copy of all courseware code.

### Issue 4: CourseWare Constructor Injects BlanksCard Into Every Course (Medium)

**File**: `packages/courseware/src/CourseWare.ts`

```
import { BlanksCard } from './default/questions/fillIn/';

// In constructor:
this.questionList = this.questionList.concat(this.getBaseQTypes());

public getBaseQTypes(): Array<typeof Displayable> {
    return [BlanksCard];
}
```

Every `CourseWare` construction forces an import of `BlanksCard`, which in turn imports:
- `lodash` (full)
- `marked` (for `Tokens` type — but it's a value import from a module with side effects)
- `FillInView.vue` → also imports lodash, and several common-ui components

This means even a hypothetical isolated chess course import would drag in lodash and marked through the BlanksCard injection.

### Issue 5: common-ui Barrel Has No Granularity (Medium)

**File**: `packages/common-ui/src/index.ts`

All ~40+ exports are eagerly imported. Heavy components are mixed in with lightweight ones:

- `TagsInput.vue` → `@vojtechlanka/vue-tags-input`
- `CodeBlockRenderer.vue` → `highlight.js` (core + 8 language bundles + CSS)
- `MarkdownRenderer.vue` / `MdTokenRenderer.vue` / `MarkdownRendererHelpers.ts` → `marked`
- `HeatMap.vue` → `moment`
- `CardHistoryViewer.vue` → `moment`
- `CompositionViewable.ts` → `moment`
- `SkldrMouseTrap.ts` → `mousetrap` + global-bind plugin

common-ui's vite config **does** externalize `moment` and `vue-tags-input`, but does **not** externalize:
- `highlight.js` (~40KB of registered languages bundled)
- `marked` (~30KB)
- `mousetrap` (~12KB)

These are bundled into common-ui's dist and then included in every consumer.

### Issue 6: Lodash Full Bundle Instead of Cherry-Picked Imports (Medium)

Multiple files import the entire lodash bundle:

| File | Import | Actually Uses |
|------|--------|--------------|
| `courseware/src/default/questions/fillIn/fillIn.vue` | `import _ from 'lodash'` | `_.shuffle` |
| `courseware/src/default/questions/fillIn/index.ts` | `import _ from 'lodash'` | `_.shuffle`, `_.sample` |
| `courseware/src/math/questions/angleCategorize/index.ts` | `import _ from 'lodash'` | `_.shuffle` |
| `courseware/src/math/utility/index.ts` | `import { isInteger } from 'lodash'` | `isInteger` |
| `courseware/src/pitch/questions/indentify/index.ts` | `import _ from 'lodash'` | likely `_.shuffle` or `_.sample` |
| `edit-ui/src/.../DataInputForm.vue` | `import _ from 'lodash'` | unknown subset |
| `platform-ui/src/views/Courses.vue` | `import _ from 'lodash'` | unknown subset |

Each `import _ from 'lodash'` pulls the full ~73KB minified bundle. Using `lodash-es` or individual imports (`import shuffle from 'lodash/shuffle'`) would allow tree-shaking.

### Issue 7: Both Apps Import All Vuetify Components (Low-Medium)

**Files**: `packages/standalone-ui/src/main.ts`, `packages/platform-ui/src/plugins/vuetify.ts`

Both apps use the same full-import pattern:

```
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
```

This imports **every** Vuetify component into the bundle. The `vuetify-loader` or `unplugin-vuetify` plugin can auto-import only used components, tree-shaking the rest.

### Issue 8: Moment.js Across Multiple Packages (Low-Medium)

`moment` appears as a dependency in **four** packages:
- `@vue-skuilder/common` (type-only import of `Moment` — but listed as runtime dep)
- `@vue-skuilder/db` (runtime usage)
- `@vue-skuilder/common-ui` (3 files: CompositionViewable, HeatMap, CardHistoryViewer)
- `@vue-skuilder/courseware` (piano views via Playback.vue, NotePlayback.vue)

moment is ~59KB minified and is not tree-shakeable. `dayjs` is a drop-in replacement at ~2KB. However, this is a pervasive replacement across many packages.

---

## Prioritized Opportunities

### Tier 1: High Impact, Moderate Effort

#### T1.1 — Route-Level Code Splitting in platform-ui

Convert eager imports in `router.ts` to dynamic imports:

```
// Before
import AdminDashboard from './views/AdminDashboard.vue';
// After
const AdminDashboard = () => import('./views/AdminDashboard.vue');
```

This alone would split the single 4.1MB chunk into an initial chunk (shared deps + Home/Login) and lazy chunks per route. Routes that pull in courseware-heavy features (Study, CourseEditor, EloModeration, AdminDashboard) would only load when navigated to.

**Estimated impact**: Could reduce initial load from ~4.1MB to ~1-1.5MB (framework + shared deps + landing views). Heavy course content loads on-demand.

**Risk**: Low. Vue Router natively supports this pattern. No API changes.

**Scope**: `packages/platform-ui/src/router.ts` — one file, ~15 import changes.

#### T1.2 — Lazy Course Loading in Courseware Barrel

Replace eager course imports with a lazy registration pattern:

```
// Before
import chess from './chess';
export const allCourseWare = new AllCourseWare([chess, math, ...]);

// After
const courseLoaders = {
  chess: () => import('./chess'),
  math: () => import('./math'),
  // ...
};
```

Modify `AllCourseWare` to support lazy resolution — courses load when first accessed. The `allCourseWare.getView()` and `allCourseWare.getCourseWare()` methods become async or return resolved courses from a cache.

**Estimated impact**: Each course becomes its own chunk. A user studying math never downloads chess.js, paper stays out until SupplementaryAngles is actually displayed, abcjs stays out until sightsing, etc. Could save 500KB-800KB from initial courseware load.

**Risk**: Medium. Consumers (`platform-ui`, `standalone-ui`) call `allCourseWare.getView()` synchronously in several places. These call sites need to be adapted to handle async resolution, or courses need to be pre-loaded during app init based on user registration.

**Scope**: 
- `packages/courseware/src/index.ts` — new lazy registration system
- `packages/courseware/src/CourseWare.ts` — possible async `AllCourseWare` methods
- `packages/platform-ui/src/main.ts` — init sequence
- `packages/platform-ui/src/views/Study.vue` — `getViewComponent`
- `packages/platform-ui/src/components/Courses/CourseInformationWrapper.vue` — `viewLookup`
- `packages/platform-ui/src/components/Courses/EloModeration.vue` — `viewLookup`
- `packages/platform-ui/src/components/Courses/TagInformation.vue` — `viewLookup`
- `packages/platform-ui/src/views/AdminDashboard.vue` — `viewLookup`
- `packages/standalone-ui/src/main.ts` — init
- Multiple standalone-ui views

#### T1.3 — Externalize Courseware from edit-ui

Add `'@vue-skuilder/courseware'` to edit-ui's `rollupOptions.external`:

```js
external: [
  'vue', 'vue-router', 'vuetify', 'pinia',
  '@vue-skuilder/db', '@vue-skuilder/common', '@vue-skuilder/common-ui',
  '@vue-skuilder/courseware',  // <-- add this
],
```

**Estimated impact**: edit-ui dist drops from 1.3MB to ~200-300KB. Eliminates potential duplicate module instances in platform-ui.

**Risk**: Low. The consuming apps (platform-ui, standalone-ui) already depend on courseware directly. This just avoids double-bundling.

**Scope**: `packages/edit-ui/vite.config.js` — one line.

### Tier 2: Medium Impact, Low-Medium Effort

#### T2.1 — Add `sideEffects` to Package Manifests

Add `"sideEffects": false` (or targeted patterns) to each library package.json:

- `packages/courseware/package.json` → `"sideEffects": ["*.css", "*.vue"]`
- `packages/common-ui/package.json` → `"sideEffects": ["*.css", "*.vue"]`
- `packages/edit-ui/package.json` → `"sideEffects": ["*.css", "*.vue"]`
- `packages/common/package.json` → `"sideEffects": false`
- `packages/db/package.json` → `"sideEffects": false`

This tells Rollup/Vite that unused exports can be safely eliminated.

**Risk**: Low if CSS/Vue files are marked as having side effects (they do — styles and component registration). Pure TS modules should be safe.

**Note**: This only helps if the barrel imports are also cleaned up (i.e., issues T1.2 and the CourseWare constructor side effects are addressed). Without that, `sideEffects` alone won't save much because everything is reachable.

#### T2.2 — Replace Full Lodash with Cherry-Picked Imports

Replace `import _ from 'lodash'` with specific imports:

```
// Before
import _ from 'lodash';
_.shuffle(arr);

// After  
import shuffle from 'lodash/shuffle';
shuffle(arr);
```

Or switch to `lodash-es` which is tree-shakeable:
```
import { shuffle } from 'lodash-es';
```

For `math/utility/index.ts` which uses only `isInteger`:
```
// Before
import { isInteger } from 'lodash';
// After — just use Number.isInteger (built-in!)
Number.isInteger(value);
```

**Estimated impact**: ~70KB saved from courseware bundle if lodash is fully eliminated.

**Risk**: Very low. These are simple, mechanical replacements.

**Scope**: 7 files across courseware, edit-ui, platform-ui.

#### T2.3 — Lazy-Load Heavy Components in common-ui

The common-ui barrel could use `defineAsyncComponent` or conditional dynamic imports for heavy components:

- `CodeBlockRenderer.vue` (highlight.js) — only used inside `MdTokenRenderer` for code blocks
- `TagsInput.vue` (vue-tags-input) — only used in editing contexts
- `CardHistoryViewer.vue` (moment) — only used in admin/stats contexts
- `HeatMap.vue` (moment) — only used in stats/study-session contexts

Since common-ui is a library build, the most practical approach is to ensure these components' heavy deps are externalized or dynamically imported within the components themselves.

**Estimated impact**: ~80KB+ savings when these components aren't rendered.

**Risk**: Low-medium. Async components need loading/error states.

#### T2.4 — Remove BlanksCard Injection from CourseWare Constructor

The `getBaseQTypes()` method in `CourseWare.ts` unconditionally returns `[BlanksCard]` for every course. This means every single course instantiation drags in the fill-in-the-blank implementation with its lodash and marked dependencies.

Options:
1. Move BlanksCard injection to the `AllCourseWare` level (only where it's actually needed)
2. Make `getBaseQTypes()` return an empty array and have the `default` course own BlanksCard exclusively
3. Lazy-load BlanksCard within `getBaseQTypes()`

**Estimated impact**: Breaks the dependency chain that makes every course import lodash and marked. Enables true per-course isolation.

**Risk**: Medium. Need to verify that existing courses don't rely on BlanksCard being present in their question list. (They likely do — this is the "every course can have fill-in-the-blank cards" feature.)

### Tier 3: Lower Impact or Higher Effort

#### T3.1 — Replace moment with dayjs

Replace `moment` (~59KB) with `dayjs` (~2KB) or `date-fns` across:
- `packages/common/src/db.ts` (type-only — might just need the `Dayjs` type)
- `packages/db/` (runtime usage)
- `packages/common-ui/` (3 files)
- `packages/courseware/src/piano/` (2 view components)

**Estimated impact**: ~57KB savings, plus moment is no longer a shared dep across 4 packages.

**Risk**: Medium. dayjs API is very similar to moment but not identical. Locale handling differs. Piano views use `moment()` for timestamps — straightforward conversion.

#### T3.2 — Externalize More Deps from common-ui

Add to common-ui's `rollupOptions.external`:
- `highlight.js` (and its sub-imports)
- `marked`
- `mousetrap`

These would then be resolved by the final app bundler, where they can be tree-shaken or code-split.

**Risk**: Medium. Consumers need these in their own dependency trees, or the build aliases need to handle resolution.

#### T3.3 — Vuetify Auto-Import for Both Apps

Replace manual full-import of all Vuetify components (in both `standalone-ui/src/main.ts` and `platform-ui/src/plugins/vuetify.ts`) with the `vuetify-loader` / `unplugin-vuetify` plugin for automatic tree-shaking.

**Estimated impact**: Depends on how many Vuetify components each app actually uses. Could save 100KB+ per app.

**Risk**: Low.

#### T3.4 — Externalize paper.js from Courseware (Quick Win for Non-Math Users)

Add `'paper'` to courseware's `rollupOptions.external`. Then have platform-ui provide it, and the SupplementaryAngles component can dynamically import it:

```
// Instead of top-level: import paper from 'paper';
const paper = await import('paper');
```

**Estimated impact**: ~234KB out of courseware dist. Only loaded when SupplementaryAngles is actually rendered.

**Risk**: Low. The paper import is in a single `.vue` file's `<script>` — easy to make dynamic.

---

## Dependency Chain Visualization

```
platform-ui (4.1MB single chunk)
├── router.ts (eagerly imports ALL views)
│   ├── Study.vue ← allCourseWare (courseware barrel)
│   ├── CourseEditor ← edit-ui ← courseware (BUNDLED INSIDE, ~1.1MB duplicate)
│   ├── AdminDashboard ← allCourseWare
│   ├── EloModeration ← allCourseWare
│   ├── TagInformation ← allCourseWare
│   ├── CourseInformationWrapper ← allCourseWare, MidiConfig
│   ├── Login, SignUp, Home, About... (lightweight, but eagerly loaded)
│   └── ...
├── main.ts
│   └── await import('@vue-skuilder/courseware')  ← good, but courseware is monolithic
│       └── courseware/index.ts
│           ├── math/ ← lodash, paper (via supplementaryAngles.vue)
│           ├── chess/ ← chess.js, chessground (vendored)
│           ├── piano/ ← moment, webmidi, @tonaljs/tonal
│           ├── sightsing/ ← abcjs (via MusicScoreRender.vue)
│           ├── french/ ← (lightweight)
│           ├── typing/ ← (lightweight)
│           ├── pitch/ ← lodash
│           ├── word-work/ ← (lightweight)
│           └── default/ ← lodash, marked (fillIn/BlanksCard)
│               └── BlanksCard ← ALSO injected into every CourseWare constructor
├── common-ui (231KB, bundles highlight.js, marked, mousetrap)
└── edit-ui (1.3MB, bundles courseware + its own components)
```

---

## Recommended Implementation Order

1. **T1.1** — Route-level code splitting in platform-ui router *(biggest bang for TTFP)*
2. **T1.3** — Externalize courseware from edit-ui *(one-line fix, prevents double-bundling)*
3. **T2.2** — Replace lodash full imports with cherry-picks *(mechanical, low risk)*
4. **T2.1** — Add `sideEffects` fields to package.json files *(enables future shaking)*
5. **T1.2** — Lazy course loading in courseware barrel *(highest architectural impact, medium effort)*
6. **T2.4** — Remove BlanksCard injection from CourseWare constructor *(prerequisite for T1.2 to be fully effective)*
7. **T3.4** — Dynamic import paper.js in SupplementaryAngles *(quick win, single file)*
8. **T2.3** — Lazy-load heavy common-ui components
9. **T3.2** — Externalize more deps from common-ui build
10. **T3.1** — Moment → dayjs migration *(cross-cutting, do last)*
11. **T3.3** — Vuetify auto-import for standalone-ui

## Recommendation

Start with **T1.1 + T1.3 + T2.2** as a first phase. These are low-risk, high-confidence changes that require no architectural redesign. T1.1 alone should dramatically improve TTFP for platform-ui.

Then proceed to **T1.2 + T2.4** as a second phase — the courseware lazy-loading redesign. This is the most architecturally significant change and will determine the long-term bundling story for the whole project. It requires careful handling of the sync→async transition in view lookup, but the payoff is large: each course becomes independently loadable.

The remaining items (T2.1, T2.3, T3.x) can be done incrementally as follow-ups.