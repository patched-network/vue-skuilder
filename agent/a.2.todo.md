# TODO: Strategy State Storage & User Tag Preferences

This document tracks implementation of unified strategy state storage, enabling both explicit user preferences and learned/temporal strategy state.

**Status**: Phase 1 COMPLETED, Phase 2 COMPLETED, Phase 3 COMPLETED, Phase 4 COMPLETED, Phase 5 PENDING

## Semantic Clarification: Goals vs Preferences

| Type | Defines | Example | Affects Progress | Status |
|------|---------|---------|------------------|--------|
| **Goal** | Destination (what to learn) | "Master ear-training" | Yes | Stub created |
| **Preference** | Path (how to learn) | "Skip text-heavy cards" | No | Implemented |
| **Inferred** | Learned patterns | "User prefers visual" | No | Stub created |

- Goals enable curriculum composition (physics defers calculus prereqs to a calculus curriculum)
- Preferences are pure path constraints within a curriculum
- Inferred preferences are future work for adaptive learning

## Context

- Assessment: `a.1.assessment.md`
- Architecture: `packages/db/docs/navigators-architecture.md`
- Prior TODO: `packages/db/docs/todo-strategy-state-storage.md`

**Key Decision**: User preferences and strategy state share the same storage mechanism. Each strategy "brings its own" schema via `STRATEGY_STATE` documents in UserDB.

---

## Phase 1: Add `STRATEGY_STATE` DocType and Storage Methods — COMPLETED

**Goal**: Establish the doc type and UserDB read/write methods.

### p1.1 Add DocType ✅

- [x] Add `STRATEGY_STATE = 'STRATEGY_STATE'` to `DocType` enum in `packages/db/src/core/types/types-legacy.ts`
- [x] Add prefix to `DocTypePrefixes`: `[DocType.STRATEGY_STATE]: 'STRATEGY_STATE'`

### p1.2 Create StrategyState type definition ✅

- [x] Create `packages/db/src/core/types/strategyState.ts`
- [x] Define `StrategyStateId` template literal type: `` `STRATEGY_STATE::${string}::${string}` ``
- [x] Define `StrategyStateDoc<T>` interface with typed `_id`, `docType`, `courseId`, `strategyKey`, `data`, `updatedAt`
- [x] Define `buildStrategyStateId()` helper returning `StrategyStateId`
- [x] Export from `packages/db/src/core/index.ts`

**Note**: Uses `::` separator (not `-`) to avoid ambiguity with hyphenated course GUIDs, consistent with `{courseID}::{cardID}` pattern elsewhere.

### p1.3 Add UserDBInterface methods ✅

- [x] Add `getStrategyState<T>()` to `UserDBReader`
- [x] Add `putStrategyState<T>()` to `UserDBWriter`
- [x] Add `deleteStrategyState()` to `UserDBWriter`

### p1.4 Implement in BaseUserDB ✅

- [x] Implement `getStrategyState()`: builds doc ID, returns `doc.data` or `null` on 404
- [x] Implement `putStrategyState()`: gets existing `_rev` if present, puts doc with updated timestamp
- [x] Implement `deleteStrategyState()`: removes doc if exists, no-op on 404

**Build verified**: `yarn workspace @vue-skuilder/db build` succeeds

---

## Phase 2: Add ContentNavigator Helper Methods — COMPLETED

**Goal**: Provide convenient protected methods on `ContentNavigator` for strategies to read/write their state.

### p2.1 Add helper methods to ContentNavigator ✅

- [x] In `packages/db/src/core/navigators/index.ts`, add to `ContentNavigator`:
  - `protected get strategyKey(): string` — defaults to `this.constructor.name`
  - `protected async getStrategyState<T>(): Promise<T | null>`
  - `protected async putStrategyState<T>(data: T): Promise<void>`
- [x] Helpers use `this.user.getStrategyState()` / `putStrategyState()`
- [x] Helpers use `this.course.getCourseID()` for courseId

### p2.2 Handle missing user/course ✅

- [x] Helpers throw meaningful error if `this.user` or `this.course` is undefined
- [x] Decision: throw on uninitialized navigator (fail-fast, not silent null)

**Build verified**: `yarn workspace @vue-skuilder/db build` succeeds

---

## Phase 3: Implement `UserTagPreferenceFilter` — COMPLETED

**Goal**: A filter that reads user tag preferences from strategy state and adjusts card scores.

### p3.1 Define preference schema ✅

- [x] Create `packages/db/src/core/navigators/filters/userTagPreference.ts`
- [x] Define `UserTagPreferenceState` interface with `prefer`, `avoid`, `boost`, `updatedAt`
- [x] Renamed fields from `include`/`exclude` to `prefer`/`avoid` to clarify preference semantics
- [x] Removed `source` field — this impl is for explicit user config only

### p3.2 Implement filter ✅

- [x] Create `UserTagPreferenceFilter` class extending `ContentNavigator` implementing `CardFilter`
- [x] `transform()` implementation:
  - Reads state via `this.getStrategyState<UserTagPreferenceState>()`
  - If no state, passes through with "no preferences" provenance
  - For each card: checks exclusions first (score=0), then applies boost multipliers
  - Appends detailed provenance entry
- [x] Tag hydration via `course.getAppliedTags()` (per-card, consistent with other filters)

### p3.3 Register in NavigatorRoles ✅

- [x] Add `USER_TAG_PREFERENCE = 'userTagPreference'` to `Navigators` enum
- [x] Add `[Navigators.USER_TAG_PREFERENCE]: NavigatorRole.FILTER` to `NavigatorRoles`

### p3.4 Export and document ✅

- [x] Export from `packages/db/src/core/navigators/filters/index.ts`
- [x] Add to `packages/db/docs/navigators-architecture.md`:
  - Added to filter implementations list
  - Added new "Strategy State Storage" section documenting the API
  - Added files to reference table

**Build verified**: `yarn workspace @vue-skuilder/db build` succeeds

### p3.5 Create stubs for related navigators ✅

- [x] Create `packages/db/src/core/navigators/userGoal.ts` (stub)
  - Documents goal semantics: destination definition, progress scoping
  - Documents curriculum composition pattern (cross-curriculum dependencies)
  - Defines placeholder `UserGoalState` interface
- [x] Create `packages/db/src/core/navigators/inferredPreference.ts` (stub)
  - Documents inference signals: dismissal patterns, time-on-card, error patterns
  - Documents transparency requirements: visible, explainable, overridable
  - Defines placeholder `InferredPreferenceState` interface
- [x] Update `packages/db/docs/navigators-architecture.md` with goals vs preferences table

---

## Phase 4: Build UI for Tag Preferences — COMPLETED

**Goal**: Users can configure their tag preferences for courses that support this filter.

### p4.1 Identify UI location ✅

- [x] User profile page (`/user/:username`) — course selector + preferences component
- [x] Course information page (for registered users) — expandable preferences panel
- [x] Generic component in common-ui; course-specific UIs can customize

### p4.2 Create preferences component ✅

- [x] Create `UserTagPreferences.vue` in `packages/common-ui/src/components/`
- [x] Component features:
  - Fetches available tags from course DB via `getCourseTagStubs()`
  - Displays current preferences (avoid/prefer lists with chips)
  - Autocomplete for adding tags with snippets
  - Visual distinction: red chips for avoid, green for prefer
  - Reset/Save buttons with loading states
  - Change detection to enable/disable save button
- [x] Export from `packages/common-ui/src/index.ts`

### p4.3 Wire up to platform-ui ✅

- [x] Add to User.vue:
  - Course selector dropdown for registered courses
  - Embedded `UserTagPreferences` component
- [x] Add to CourseInformationWrapper.vue:
  - Expandable panel for registered users
  - Appears in "additional-content" slot

### p4.4 Integration ✅

- [x] Uses `userDB.getStrategyState()` / `putStrategyState()` for persistence
- [x] Uses `STRATEGY_KEY = 'UserTagPreferenceFilter'` to match filter
- [x] Emits `preferences-saved` and `preferences-changed` events

**Build verified**: Both `@vue-skuilder/common-ui` and `@vue-skuilder/platform-ui` build successfully

---

## Phase 5: Simplify Tag Preferences to Single Slider Model — PENDING

**Goal**: Replace separate `prefer`/`avoid` lists with a unified slider-based approach using only the `boost` multiplier record.

**Breaking Change**: This is a breaking schema change. No migration needed as this is an active dev branch not yet in production.

### p5.1 Update UserTagPreferenceState schema ✅

**File**: `packages/db/src/core/navigators/filters/userTagPreference.ts`

- [x] Remove `prefer: string[]` and `avoid: string[]` fields
- [x] Keep only `boost: Record<string, number>` and `updatedAt: string`
- [x] Update interface documentation to explain slider semantics:
  - `0` = banish/exclude (card score = 0)
  - `0.5` = penalize by 50%
  - `1.0` = neutral/no effect (default)
  - `2.0` = 2x preference boost
  - etc.
- [x] Remove `DEFAULT_BOOST` constant (no longer needed)

### p5.2 Refactor UserTagPreferenceFilter.transform() ✅

**File**: `packages/db/src/core/navigators/filters/userTagPreference.ts`

- [x] Remove `hasAvoidedTag()` helper method
- [x] Remove `computeBoost()` helper method
- [x] Add new `computeMultiplier()` helper method
- [x] Simplify `transform()` logic:
  - If no state or empty `boost` record, pass through unchanged
  - For each card with tags:
    - Look up tag in `boost` record
    - If tag found: apply multiplier (0 = exclude, 1 = neutral, >1 = boost)
    - If multiple tags match: use max multiplier among matching tags
    - Append provenance with clear reason
- [x] Update `buildReason()` to reflect new semantics:
  - "Excluded by user preference: {tag} (0x)"
  - "Penalized by user preference: {tag} (0.5x)"
  - "Neutral - no preference effect"
  - "Boosted by user preference: {tag} (2x)"

**Build verified**: `yarn workspace @vue-skuilder/db build` succeeds

### p5.3 Refactor UserTagPreferences.vue component

**File**: `packages/common-ui/src/components/UserTagPreferences.vue`

- [ ] Remove separate "Avoid" and "Prefer" sections
- [ ] Add single section: "Tag Preferences" with unified tag list
- [ ] Replace chip-based display with tag + slider rows:
  - Tag name (chip or text)
  - Slider (v-slider) with current multiplier
  - Remove/delete button (v-btn with icon, e.g., mdi-delete or mdi-close)
- [ ] Slider configuration:
  - Default value: `1.0` when tag added
  - Initial range: `0` to `2`
  - Step: `0.01`
  - Show current value next to slider (e.g., "1.5x")
- [ ] Dynamic range expansion:
  - When slider reaches max value, show (+) button
  - (+) button increments max range by 1 (e.g., 2 → 3 → 4)
  - Cap at absolute max (default `10`, configurable via props)
- [ ] Keep autocomplete for adding tags (existing implementation)
- [ ] Update data model:
  - Remove `preferences.prefer` and `preferences.avoid`
  - Keep only `preferences.boost`
  - Same for `savedPreferences`

### p5.4 Add slider configuration props

**File**: `packages/common-ui/src/components/UserTagPreferences.vue`

- [ ] Add new prop `sliderConfig` with type:
  ```typescript
  interface SliderConfig {
    min?: number;        // default: 0
    startingMax?: number; // default: 2
    absoluteMax?: number; // default: 10
  }
  ```
- [ ] Default values: `{ min: 0, startingMax: 2, absoluteMax: 10 }`
- [ ] Make prop optional (use defaults if not provided)
- [ ] Track per-tag current max in component state (for dynamic expansion)

### p5.5 Update component methods

**File**: `packages/common-ui/src/components/UserTagPreferences.vue`

- [ ] Remove `addAvoidTag()`, `removeAvoidTag()`, `addPreferTag()`, `removePreferTag()`
- [ ] Add unified methods:
  - `addTag(tagName: string)`: adds to `boost` record with value `1.0`
  - `removeTag(tagName: string)`: removes from `boost` record
  - `updateBoost(tagName: string, value: number)`: updates multiplier
  - `expandSliderRange(tagName: string)`: increments max for this tag's slider
- [ ] Update `hasChanges` computed to compare only `boost` records
- [ ] Update `savePreferences()` to save simplified schema
- [ ] Update `loadPreferences()` to load simplified schema

### p5.6 Update visuals (Vuetify 3)

**File**: `packages/common-ui/src/components/UserTagPreferences.vue`

- [ ] Use `v-list` or `v-card` for each tag row
- [ ] Layout per tag:
  - Tag name (left-aligned)
  - `v-slider` (flexible width, middle)
  - Current value display (e.g., "1.5x", right of slider)
  - (+) button when at max (conditional, v-if)
  - Delete icon button (right-aligned)
- [ ] KISS approach: no color zones, plain slider
- [ ] Keep existing autocomplete styling

### p5.7 Update Files Summary table

**File**: `agent/a.2.todo.md`

- [x] Add Phase 5 entries to Files Summary table at end of document

---

## Open Questions / Parking Lot

- [ ] **Tag hydration**: Should `FilterContext` include pre-hydrated tags for all cards? (see `todo-pipeline-optimization.md`)
>>> will refactor to include this post pipeline-optimization
- [ ] **Preferences schema export**: Should strategies export a static schema for UI generation?
- [ ] **Migration**: What happens to existing `CourseRegistration.settings` usage? (currently minimal)
>>> retain existing - minimal is OK.
- [ ] **Sync conflicts**: How to handle two-device concurrent edits to strategy state?
>>> not too worried - let couch / pouch sort it out.

---

## Files Summary

| Phase | File | Action |
|-------|------|--------|
| 1 | `packages/db/src/core/types/types-legacy.ts` | MODIFY - add DocType |
| 1 | `packages/db/src/core/types/strategyState.ts` | CREATE |
| 1 | `packages/db/src/core/interfaces/userDB.ts` | MODIFY - add methods |
| 1 | `packages/db/src/impl/common/BaseUserDB.ts` | MODIFY - implement methods |
| 2 | `packages/db/src/core/navigators/index.ts` | MODIFY - add helpers |
| 3 | `packages/db/src/core/navigators/filters/userTagPreference.ts` | CREATE |
| 3 | `packages/db/src/core/navigators/filters/index.ts` | MODIFY - export |
| 3 | `packages/db/src/core/navigators/userGoal.ts` | CREATE - stub |
| 3 | `packages/db/src/core/navigators/inferredPreference.ts` | CREATE - stub |
| 3 | `packages/db/docs/navigators-architecture.md` | MODIFY - document |
| 4 | `packages/common-ui/src/components/UserTagPreferences.vue` | CREATE |
| 4 | `packages/common-ui/src/index.ts` | MODIFY - export |
| 4 | `packages/platform-ui/src/views/User.vue` | MODIFY - add preferences |
| 4 | `packages/platform-ui/src/components/Courses/CourseInformationWrapper.vue` | MODIFY - add panel |
| 5 | `packages/db/src/core/navigators/filters/userTagPreference.ts` | MODIFY - simplify schema and logic |
| 5 | `packages/common-ui/src/components/UserTagPreferences.vue` | MODIFY - slider-based UI |
