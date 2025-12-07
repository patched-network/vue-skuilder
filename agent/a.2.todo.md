# TODO: Strategy State Storage & User Tag Preferences

This document tracks implementation of unified strategy state storage, enabling both explicit user preferences and learned/temporal strategy state.

**Status**: Phase 1 COMPLETED, Phase 2 COMPLETED, Phase 3 COMPLETED, Phase 4 NEXT

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

## Phase 4: Build UI for Tag Preferences

**Goal**: Users can configure their tag preferences for courses that support this filter.

### p4.1 Identify UI location

- [ ] Determine where preferences UI lives (course settings page? onboarding?)
- [ ] Confirm course must have `UserTagPreferenceFilter` in its strategy config

### p4.2 Create preferences component

- [ ] Create Vue component for tag preference editing
- [ ] Component should:
  - Fetch available tags from course DB
  - Display current preferences (from strategy state)
  - Allow add/remove include/exclude tags
  - Save to strategy state via user DB

### p4.3 Wire up to user DB

- [ ] Use `userDB.putStrategyState()` to persist preferences
- [ ] Handle optimistic updates / loading states

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
| 4 | `packages/platform-ui/src/components/...` | CREATE - UI component |
