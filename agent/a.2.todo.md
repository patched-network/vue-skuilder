# TODO: Strategy State Storage & User Tag Preferences

This document tracks implementation of unified strategy state storage, enabling both explicit user preferences and learned/temporal strategy state.

**Status**: Phase 1 COMPLETED, Phase 2 NEXT

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

## Phase 2: Add ContentNavigator Helper Methods

**Goal**: Provide convenient protected methods on `ContentNavigator` for strategies to read/write their state.

### p2.1 Add helper methods to ContentNavigator

- [ ] In `packages/db/src/core/navigators/index.ts`, add to `ContentNavigator`:
  ```
  protected async getStrategyState<T>(): Promise<T | null>
  protected async putStrategyState<T>(data: T): Promise<void>
  protected get strategyKey(): string  // default: this.constructor.name
  ```
- [ ] Helpers should use `this.user.getStrategyState()` / `putStrategyState()`
- [ ] Helpers should use `this.course.getCourseID()` for courseId

### p2.2 Handle missing user/course

- [ ] Helpers should throw meaningful error if `this.user` or `this.course` is undefined
- [ ] Consider: should `getStrategyState()` return null or throw if navigator not properly initialized?

---

## Phase 3: Implement `UserTagPreferenceFilter`

**Goal**: A filter that reads user tag preferences from strategy state and adjusts card scores.

### p3.1 Define preference schema

- [ ] Create `packages/db/src/core/navigators/filters/userTagPreference.ts`
- [ ] Define `UserTagPreferenceState` interface:
  ```
  interface UserTagPreferenceState {
    include: string[];       // Tags to boost
    exclude: string[];       // Tags to exclude (score=0)
    boost: Record<string, number>;  // Tag -> multiplier
    source: 'user' | 'inferred';
    updatedAt: string;
  }
  ```

### p3.2 Implement filter

- [ ] Create `UserTagPreferenceFilter` class extending `ContentNavigator` implementing `CardFilter`
- [ ] `transform()` implementation:
  - Read state via `this.getStrategyState<UserTagPreferenceState>()`
  - If no state, pass through unchanged (no-op)
  - For each card:
    - Get card tags (need to hydrate from course DB)
    - If any `exclude` tag present → `score = 0`
    - If any `include` tag present → apply boost multiplier
    - Append provenance entry
- [ ] Handle tag hydration efficiently (batch lookup if FilterContext provides it, else individual)

### p3.3 Register in NavigatorRoles

- [ ] Add `USER_TAG_PREFERENCE = 'userTagPreference'` to `Navigators` enum
- [ ] Add `[Navigators.USER_TAG_PREFERENCE]: NavigatorRole.FILTER` to `NavigatorRoles`

### p3.4 Export and document

- [ ] Export from `packages/db/src/core/navigators/filters/index.ts`
- [ ] Add to `packages/db/docs/navigators-architecture.md` file reference table

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
| 3 | `packages/db/docs/navigators-architecture.md` | MODIFY - document |
| 4 | `packages/platform-ui/src/components/...` | CREATE - UI component |
