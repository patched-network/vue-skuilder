# Todo: CardHydrationService Map-Based Refactor

## Phase 1: CardHydrationService Core Refactor - COMPLETED

- [x] p1.1 Replace `hydratedQ: ItemQueue` with `hydratedCards: Map<string, HydratedCard>`
- [x] p1.2 Add `hydrationInFlight: Set<string>` to track in-progress hydrations
- [x] p1.3 Remove `failedCardCache` (no longer needed)
- [x] p1.4 Implement new public API:
  - [x] p1.4.1 `getHydratedCard(cardId: string): HydratedCard | null`
  - [x] p1.4.2 `hasHydratedCard(cardId: string): boolean`
  - [x] p1.4.3 `removeCard(cardId: string): void`
  - [x] p1.4.4 `waitForCard(cardId: string): Promise<HydratedCard | null>`
- [x] p1.5 Rename/refactor `fillHydratedQueue()` → `fillHydratedCards()` to populate Map
- [x] p1.6 Update `hydratedCount` getter to return `hydratedCards.size`
- [x] p1.7 Remove deprecated methods:
  - [x] p1.7.1 `dequeueHydratedCard()` - replaced by `getHydratedCard()`
  - [x] p1.7.2 `cacheFailedCard()` - no longer needed
  - [x] p1.7.3 `failedCacheSize` getter - replaced by `getHydratedCardIds()` for debugging

## Phase 2: SessionController Integration - COMPLETED

- [x] p2.1 Refactor `nextCard()` to use new hydration service API:
  - [x] p2.1.1 Call `_selectNextItemToHydrate()` first
  - [x] p2.1.2 Look up via `getHydratedCard(cardId)`
  - [x] p2.1.3 Use `waitForCard()` if not yet hydrated
  - [x] p2.1.4 Call `removeItemFromQueue()` after consumption
- [x] p2.2 Update `dismissCurrentCard()`:
  - [x] p2.2.1 On `'dismiss-success'`: call `removeCard()` to free memory
  - [x] p2.2.2 On `'marked-failed'`: ensure card stays in map (no removal)
  - [x] p2.2.3 On `'dismiss-error'`: call `removeCard()` to free memory
  - [x] p2.2.4 On `'dismiss-failed'`: call `removeCard()` to free memory
- [x] p2.3 Update `getDebugInfo()` to reflect new structure (now shows `cardIds` instead of `failedCacheSize`)

## Phase 3: Cleanup & Verification - COMPLETED

- [x] p3.1 Remove unused `hasAvailableCards` callback from constructor
- [x] p3.2 Remove unused `hasAvailableCards()` method from SessionController
- [x] p3.3 Run build: `yarn workspace @vue-skuilder/db build` ✓
- [x] p3.4 Run lint: `yarn workspace @vue-skuilder/db lint:fix` ✓

## Phase 4: Deterministic Hydration Targeting - COMPLETED

Addressed issue: `selectNextItemToHydrate` was nondeterministic (uses `Math.random()`) and was being shared between:
- `SessionController.nextCard()` - for card selection
- `CardHydrationService.fillHydratedCards()` - for pre-fetching

This could cause mismatches where hydrated cards don't match what `nextCard()` actually selects.

- [x] p4.1 Create new deterministic `_getItemsToHydrate()` method in SessionController
  - Returns top 2 items from each queue (reviewQ, newQ, failedQ)
  - Ensures coverage regardless of which queue `nextCard()` picks from
- [x] p4.2 Update CardHydrationService constructor to take `getItemsToHydrate: () => StudySessionItem[]`
- [x] p4.3 Remove `removeItemFromQueue` callback from CardHydrationService
  - Hydration service no longer mutates queue state
  - Queue removal happens only in `SessionController.nextCard()`
- [x] p4.4 Update `fillHydratedCards()` to iterate over items list instead of while-loop
- [x] p4.5 Remove `BUFFER_SIZE` constant (no longer needed - coverage is determined by items list)
- [x] p4.6 Fix `removeItemFromQueue()` to use cardID comparison (not reference equality)
- [x] p4.7 Run build ✓
- [x] p4.8 Run lint ✓

## Phase 5: Manual Verification

- [ ] p5.1 Manual verification with dev server (deferred to user)

## Summary of Changes

### CardHydrationService.ts
- Replaced queue+cache dual storage with single `Map<string, HydratedCard>`
- Added `hydrationInFlight: Set<string>` for race condition protection
- New constructor signature: `(getViewComponent, getCourseDB, getItemsToHydrate)`
- New public API: `getHydratedCard()`, `hasHydratedCard()`, `removeCard()`, `waitForCard()`
- Added `getHydratedCardIds()` for debugging
- Removed: `dequeueHydratedCard()`, `cacheFailedCard()`, `failedCacheSize`, `waitForHydratedCard()`
- Removed: `removeItemFromQueue` callback, `BUFFER_SIZE` constant
- `fillHydratedCards()` now iterates over items list (no queue mutation)

### SessionController.ts
- New `_getItemsToHydrate()`: deterministic, returns top 2 from each queue
- `_selectNextItemToHydrate()`: unchanged, still nondeterministic for card selection
- `nextCard()` calls `_selectNextItemToHydrate()` first, then looks up by ID
- `dismissCurrentCard()` calls `removeCard()` on all dismiss actions except `'marked-failed'`
- `removeItemFromQueue()` now uses cardID comparison, only called from `nextCard()`
- Removed `hasAvailableCards()` method
- Updated `getDebugInfo()` to show `cardIds` array

### Separation of Concerns
- **SessionController**: owns queue state, ordering decisions, consumption
- **CardHydrationService**: pure cache warmer, no side effects on queue state