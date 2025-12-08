# Plan: Batch Tag Hydration for Pipeline Optimization

## Summary

Implement batch tag hydration in the Pipeline to eliminate redundant per-card tag lookups across multiple filters. This extends `WeightedCard` with optional `tags`, adds `getAppliedTagsBatch()` to `CourseDBInterface`, and hydrates cards after generation but before filtering.

## Architecture

```
BEFORE:
Pipeline.getWeightedCards()
  → generator.getWeightedCards()           → [cards without tags]
  → filter1.transform()                    → getAppliedTags(card1), getAppliedTags(card2), ...
  → filter2.transform()                    → getAppliedTags(card1), getAppliedTags(card2), ...
  → filter3.transform()                    → getAppliedTags(card1), getAppliedTags(card2), ...
  = N × F database queries

AFTER:
Pipeline.getWeightedCards()
  → generator.getWeightedCards()           → [cards without tags]
  → hydrateTags(cards)                     → getAppliedTagsBatch([card1, card2, ...])
  → filter1.transform()                    → uses card.tags
  → filter2.transform()                    → uses card.tags
  → filter3.transform()                    → uses card.tags
  = 1 batch query
```

## Implementation Details

### 1. WeightedCard Extension

**File:** `packages/db/src/core/navigators/index.ts`

```typescript
export interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;
  provenance: StrategyContribution[];
  
  /** Pre-fetched tags. Populated by Pipeline before filters run. */
  tags?: string[];
}
```

### 2. CourseDBInterface Extension

**File:** `packages/db/src/core/interfaces/courseDB.ts`

```typescript
/**
 * Get tags for multiple cards in a single batch query.
 * More efficient than calling getAppliedTags() for each card.
 * 
 * @param cardIds - Array of card IDs to fetch tags for
 * @returns Map from cardId to array of tag names
 */
getAppliedTagsBatch(cardIds: string[]): Promise<Map<string, string[]>>;
```

### 3. CouchDB Implementation

**File:** `packages/db/src/impl/couch/courseDB.ts`

Use CouchDB's `keys` query parameter to fetch all tags in one query:

```typescript
async getAppliedTagsBatch(cardIds: string[]): Promise<Map<string, string[]>> {
  if (cardIds.length === 0) {
    return new Map();
  }

  const result = await this.db.query<TagStub>('getTags', {
    keys: cardIds,
    include_docs: false,
  });

  const tagsByCard = new Map<string, string[]>();
  
  // Initialize all requested cards with empty arrays
  for (const cardId of cardIds) {
    tagsByCard.set(cardId, []);
  }
  
  // Populate from query results
  for (const row of result.rows) {
    const cardId = row.key as string;
    const tagName = row.value?.name;
    if (tagName && tagsByCard.has(cardId)) {
      tagsByCard.get(cardId)!.push(tagName);
    }
  }

  return tagsByCard;
}
```

### 4. Static Implementation

**File:** `packages/db/src/impl/static/courseDB.ts`

Trivial implementation using existing `byCard` index:

```typescript
async getAppliedTagsBatch(cardIds: string[]): Promise<Map<string, string[]>> {
  const tagsIndex = await this.unpacker.getTagsIndex();
  const tagsByCard = new Map<string, string[]>();

  for (const cardId of cardIds) {
    tagsByCard.set(cardId, tagsIndex.byCard[cardId] || []);
  }

  return tagsByCard;
}
```

### 5. Pipeline Hydration

**File:** `packages/db/src/core/navigators/Pipeline.ts`

Add hydration step after generator, before filters:

```typescript
async getWeightedCards(limit: number): Promise<WeightedCard[]> {
  const context = await this.buildContext();
  
  const fetchLimit = Math.ceil(limit * (2 + this.filters.length * 0.5));
  let cards = await this.generator.getWeightedCards(fetchLimit, context);

  // Batch hydrate tags before filters run
  cards = await this.hydrateTags(cards);

  for (const filter of this.filters) {
    cards = await filter.transform(cards, context);
  }

  return cards.filter(c => c.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, limit);
}

private async hydrateTags(cards: WeightedCard[]): Promise<WeightedCard[]> {
  if (cards.length === 0) {
    return cards;
  }

  const cardIds = cards.map(c => c.cardId);
  const tagsByCard = await this.course!.getAppliedTagsBatch(cardIds);

  return cards.map(card => ({
    ...card,
    tags: tagsByCard.get(card.cardId) ?? [],
  }));
}
```

### 6. Filter Updates

Each filter that uses tags should prefer pre-hydrated tags:

**Pattern for all tag-using filters:**

```typescript
private async getCardTags(card: WeightedCard, course: CourseDBInterface): Promise<string[]> {
  // Use pre-hydrated tags if available
  if (card.tags) {
    return card.tags;
  }
  
  // Fallback to individual query (backward compat)
  try {
    const tagResponse = await course.getAppliedTags(card.cardId);
    return tagResponse.rows.map(r => r.value?.name || r.key).filter(Boolean);
  } catch {
    return [];
  }
}
```

**Files to update:**
- `packages/db/src/core/navigators/hierarchyDefinition.ts`
- `packages/db/src/core/navigators/interferenceMitigator.ts`
- `packages/db/src/core/navigators/relativePriority.ts`
- `packages/db/src/core/navigators/filters/userTagPreference.ts`

## Success Criteria

1. **Functional:** All existing filter tests pass unchanged
2. **Performance:** Tag lookups reduced from N×F to 1 batch query
3. **Backward Compatible:** Filters work if `card.tags` is undefined
4. **Observable:** Logger shows single batch query instead of N individual queries

## Known Risks

| Risk | Mitigation |
|------|------------|
| Large batch queries | CouchDB handles this well; static is O(n) map lookups |
| Memory for hydrated cards | Tags are just string arrays; negligible |
| Cards hydrated then filtered out | Small cost vs. N×F queries |
| Existing callers of getAppliedTags | Unchanged; new batch method is additive |

## Files to Modify

| File | Change |
|------|--------|
| `core/navigators/index.ts` | Add `tags?: string[]` to WeightedCard |
| `core/interfaces/courseDB.ts` | Add `getAppliedTagsBatch()` signature |
| `impl/couch/courseDB.ts` | Implement batch query |
| `impl/static/courseDB.ts` | Implement batch lookup |
| `core/navigators/Pipeline.ts` | Add `hydrateTags()` step |
| `core/navigators/hierarchyDefinition.ts` | Use `card.tags` when available |
| `core/navigators/interferenceMitigator.ts` | Use `card.tags` when available |
| `core/navigators/relativePriority.ts` | Use `card.tags` when available |
| `core/navigators/filters/userTagPreference.ts` | Use `card.tags` when available |

## Estimated Effort

- Phase 1 (Interface + Types): ~30 min
- Phase 2 (Implementations): ~45 min
- Phase 3 (Pipeline integration): ~20 min
- Phase 4 (Filter updates): ~30 min
- Total: ~2 hours