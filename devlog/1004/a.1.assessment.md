# Assessment: Batch Tag Hydration for Pipeline Optimization

## Problem Statement

During card navigation, multiple filter strategies independently query for card tags, resulting in redundant database operations.

**Current flow:**
```
Pipeline.getWeightedCards()
  → generator produces N candidates
  → filter1.transform() → calls getAppliedTags() for each card
  → filter2.transform() → calls getAppliedTags() for each card
  → filter3.transform() → calls getAppliedTags() for each card
```

**Impact:** For 20 cards through 3 filters = 60 tag lookups, when 20 would suffice.

## Current Architecture Analysis

### Data Model

Tags are stored as documents with this structure:
```typescript
interface Tag {
  _id: string;              // "TAG-{tagName}"
  docType: DocType.TAG;
  name: string;
  taggedCards: string[];    // List of card IDs that have this tag
  // ... other fields
}
```

Notably: **Tags contain card lists, not the other way around.** A card doesn't store its tags; instead, each tag stores which cards it applies to.

### CouchDB View Implementation

The `getTags` view inverts this relationship for lookup:

```javascript
// design-docs.ts
map: function (doc) {
  if (doc.docType && doc.docType === "TAG") {
    for (var cardIndex in doc.taggedCards) {
      emit(doc.taggedCards[cardIndex], {
        docType: doc.docType,
        name: doc.name,
        // ...
      });
    }
  }
}
```

This emits one row per (cardId, tag) pair, keyed by cardId. Querying with `startkey=cardId, endkey=cardId` returns all tags for that card.

**Key insight:** The view already supports batch queries via CouchDB's `keys` parameter!

### Static Implementation

Static courses pre-compute a `TagsIndex`:
```typescript
interface TagsIndex {
  byTag: Record<string, string[]>;  // tagName → cardIds
  byCard: Record<string, string[]>; // cardId → tagNames  ← This is what we need!
}
```

The static implementation already has `byCard` — batch lookup is trivial there.

### Current Consumers

Filters that query tags per-card:

| Filter | Usage |
|--------|-------|
| `HierarchyDefinitionNavigator` | `getAppliedTags()` to check prerequisite tags |
| `InterferenceMitigatorNavigator` | `getAppliedTags()` to detect interfering tags |
| `RelativePriorityNavigator` | `getAppliedTags()` to compute priority |
| `UserTagPreferenceFilter` | `getAppliedTags()` to apply user boosts |

All follow the same pattern:
```typescript
const tagResponse = await course.getAppliedTags(cardId);
const cardTags = tagResponse.rows.map(r => r.value?.name || r.key);
```

---

## Options

### Option A: Batch API + Pipeline Hydration

**Approach:** Add `getAppliedTagsBatch()` to CourseDBInterface. Pipeline pre-hydrates tags on `WeightedCard` before filters run.

**Implementation:**
1. Add `tags?: string[]` to `WeightedCard` interface
2. Add `getAppliedTagsBatch(cardIds: string[]): Promise<Map<string, string[]>>` to `CourseDBInterface`
3. Implement in both CouchDB (using `keys` query parameter) and Static (trivial)
4. Pipeline calls `hydrateTags()` after generator, before filters
5. Filters check `card.tags ??` before calling `getAppliedTags()`

**Pros:**
- Minimal changes to filters (1-line fallback check)
- Centralized hydration logic in Pipeline
- Works for both DB backends
- Clear separation: Pipeline handles batching, filters use pre-fetched data

**Cons:**
- WeightedCard grows slightly
- All filters must remember to check `card.tags` first
- Hydrates all cards even if some get filtered early

### Option B: Lazy Hydration with Caching Context

**Approach:** Add a shared cache in `FilterContext` that filters populate lazily.

**Implementation:**
1. Add `tagCache: Map<string, string[]>` to `FilterContext`
2. Filters call `context.getCardTags(cardId)` which checks cache first
3. On cache miss, fetches and caches the result

**Pros:**
- No changes to WeightedCard
- Only fetches tags for cards that need them
- Filters get uniform API

**Cons:**
- Still N calls on first filter (cache cold)
- Requires context to hold mutable state
- Filters must use context method, not direct API call
- More complex cache invalidation story

### Option C: Batch on First Filter (Lazy Batch)

**Approach:** First filter to need tags triggers batch hydration via context.

**Implementation:**
1. Add `ensureTagsHydrated(cards: WeightedCard[])` to context
2. First filter that needs tags calls it
3. Subsequent filters find `card.tags` already populated

**Pros:**
- Only hydrates if at least one filter needs tags
- Single batch call

**Cons:**
- Filters must coordinate ("has someone hydrated yet?")
- Implicit contract between filters
- Harder to reason about

### Option D: Parallel Pre-Fetch in Pipeline

**Approach:** Pipeline fetches tags in parallel with generator.

**Implementation:**
1. Generator returns candidates
2. Pipeline immediately starts tag batch fetch (async)
3. First filter awaits the tag promise before proceeding

**Pros:**
- Overlaps I/O with generator work
- Tags ready by filter time

**Cons:**
- Fetches tags for all potential cards, even if generator filters some
- More complex async coordination
- Marginal benefit (generator is fast)

---

## Key Considerations

### CouchDB Keys Query

The CouchDB view already supports batch lookup. A single query with:
```javascript
db.query('getTags', { keys: [cardId1, cardId2, ...] })
```
Returns all tags for all specified cards in one round-trip. This is the fundamental enabler.

### Static Backend

Trivial: `tagsIndex.byCard` already provides O(1) lookup by card. Batch is just multiple map accesses.

### Filter Fallback Pattern

Regardless of approach, filters need a graceful fallback:
```typescript
const tags = card.tags ?? await this.getCardTags(cardId, context.course);
```

This maintains backward compatibility if a card somehow lacks hydrated tags.

---

## Recommendation

**Option A: Batch API + Pipeline Hydration**

Reasons:
1. **Simplest mental model:** Pipeline is responsible for preparing cards, filters are responsible for scoring them
2. **Matches existing pattern:** Pipeline already builds context (userElo, etc.) before filters
3. **CouchDB native:** Uses built-in `keys` query parameter
4. **Static trivial:** Already has `byCard` index
5. **Minimal filter changes:** One-line fallback check
6. **Testable:** Batch method can be unit tested independently

The hydration cost for "extra" cards (those filtered to 0 early) is negligible compared to N×F individual queries.

### Estimated Impact

| Scenario | Current | After |
|----------|---------|-------|
| 20 cards, 3 filters | 60 DB queries | 1 batch query |
| 50 cards, 4 filters | 200 DB queries | 1 batch query |

Additionally, CouchDB can optimize batch queries better than serial queries.

---

## Next Steps

If Option A is approved:
1. Create `a.2.plan.md` with implementation details
2. Create `a.3.todo.md` with phased task breakdown
3. Proceed with implementation