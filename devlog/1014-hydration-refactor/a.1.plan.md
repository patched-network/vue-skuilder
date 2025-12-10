# Plan: CardHydrationService Refactor to Map-Based Lookup

## Context

The `CardHydrationService` currently uses two storage mechanisms:
1. `hydratedQ` (ItemQueue) - a FIFO queue of pre-hydrated cards
2. `failedCardCache` (Map) - a map for caching failed cards by ID

This dual structure causes problems when failed cards re-enter the session: the queue's ordering doesn't match `SessionController`'s card selection logic, leading to "missing" card data.

## Selected Approach

Replace both storage mechanisms with a single `Map<string, HydratedCard>`. The hydration service becomes a pure cache; `SessionController` owns all ordering decisions.

## Rationale

1. **Single source of truth** - all hydrated cards live in one Map, keyed by cardID
2. **No ordering assumptions** - hydration service doesn't impose order on consumption
3. **Failed cards "just work"** - already in the map from initial hydration; no separate caching
4. **Simpler mental model** - "is card X hydrated? yes/no"

## Files to Modify

### Primary Changes

1. **`packages/db/src/study/services/CardHydrationService.ts`**
   - Replace `hydratedQ: ItemQueue` with `hydratedCards: Map<string, HydratedCard>`
   - Remove `failedCardCache` (merged into hydratedCards)
   - New public API:
     - `getHydratedCard(cardId: string): HydratedCard | null`
     - `hasHydratedCard(cardId: string): boolean`
     - `removeCard(cardId: string): void` (for cleanup on successful dismiss)
   - Deprecate/remove:
     - `dequeueHydratedCard()` - replaced by `getHydratedCard()`
     - `cacheFailedCard()` - no longer needed
   - Modify `fillHydratedQueue()` → `fillHydratedCards()` to populate Map instead of queue
   - Update `hydratedCount` getter to return `hydratedCards.size`
   - Remove `failedCacheSize` getter (no longer relevant)

2. **`packages/db/src/study/SessionController.ts`**
   - Modify `nextCard()`:
     - Call `_selectNextItemToHydrate()` to get next `StudySessionItem`
     - Look up via `hydrationService.getHydratedCard(item.cardID)`
     - If not hydrated, wait for hydration to complete
   - Modify `dismissCurrentCard()`:
     - On `'dismiss-success'`: call `hydrationService.removeCard(cardId)` to free memory
     - On `'marked-failed'`: do NOT call removeCard (keep in map for re-use)
   - Update `getDebugInfo()` to reflect new structure

### Secondary/Cleanup

3. **Remove queue-based tracking from hydration service**
   - The `seenCardIds` logic in ItemQueue was preventing re-adds; this is no longer relevant since we're using a Map (natural deduplication)

## Success Criteria

1. Failed cards can be re-rendered without data loss
2. Card selection order is solely determined by `SessionController._selectNextItemToHydrate()`
3. No regression in pre-fetching behavior (still hydrate ~5 cards ahead)
4. Debug info accurately reflects hydrated card state

## Known Risks

1. **Memory management** - Cards stay in map until explicitly removed. Must ensure `removeCard()` is called on successful dismiss.
2. **Race conditions** - Multiple calls to `_selectNextItemToHydrate()` could request the same card. Need to track in-flight hydrations.
3. **Pre-fetch targeting** - Current logic assumes items are removed from source queues after hydration starts. Need to preserve this behavior.

## Implementation Notes

### In-Flight Hydration Tracking

Add `hydrationInFlight: Set<string>` to prevent duplicate hydration requests:

```ts
private async hydrateCard(item: StudySessionItem): Promise<void> {
  if (this.hydratedCards.has(item.cardID) || this.hydrationInFlight.has(item.cardID)) {
    return; // Already hydrated or in progress
  }
  this.hydrationInFlight.add(item.cardID);
  try {
    // ... hydration logic ...
    this.hydratedCards.set(item.cardID, hydratedCard);
  } finally {
    this.hydrationInFlight.delete(item.cardID);
  }
}
```

### SessionController.nextCard() Flow

```ts
public async nextCard(action: SessionAction = 'dismiss-success'): Promise<HydratedCard | null> {
  this.dismissCurrentCard(action);
  
  // Get what SessionController thinks should be next
  const nextItem = this._selectNextItemToHydrate();
  if (!nextItem) {
    this._currentCard = null;
    return null;
  }
  
  // Look up in hydration cache
  let card = this.hydrationService.getHydratedCard(nextItem.cardID);
  
  // If not ready, wait for it
  if (!card) {
    card = await this.hydrationService.waitForCard(nextItem.cardID);
  }
  
  // Remove from source queue now that we're consuming it
  this.removeItemFromQueue(nextItem);
  
  // Trigger background pre-fetch
  await this.hydrationService.ensureHydratedCards();
  
  this._currentCard = card;
  return card;
}
```

## Non-Goals

- Changing the card selection algorithm (`_selectNextItemToHydrate`)
- Modifying the source queue structures (`reviewQ`, `newQ`, `failedQ`)
- Altering the session timing logic