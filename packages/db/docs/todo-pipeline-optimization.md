# TODO: Strategy Pipeline Optimization

## Status: NOT STARTED

## Preferred Direction: Eliminate Delegate Pattern

The current delegate-chain architecture is over-engineered. A simpler model:

**Current (complex):**
```
Filter3(delegate=Filter2(delegate=Filter1(delegate=Generator)))
```
Each filter wraps another, creating nested instantiation. Filters need `delegateStrategy` 
config, lazy delegate creation, `serializedData` parsing, etc.

**Simpler model:**
```
cards = Generator.getWeightedCards()
cards = Filter1.transform(cards)
cards = Filter2.transform(cards)
cards = Filter3.transform(cards)
```

Generators produce a list. Filters are pure functions on that list. No wrapping, no 
delegates, no `serializedData.delegateStrategy`.

```typescript
interface CardFilter {
  transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]>;
}

class Pipeline {
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // 1. Collect from all generators (via CompositeGenerator if multiple)
    let cards = await this.generator.getWeightedCards(limit);
    
    // 2. Run through filters sequentially
    for (const filter of this.filters) {
      cards = await filter.transform(cards, this.context);
    }
    
    return cards.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
```

**Benefits:**
- No nested instantiation complexity
- Filters don't need to know about delegates
- Easy to add/remove/reorder filters
- Natural place to hydrate shared data (tags, etc.) before filter pass
- Aligns with "all filters are multipliers" convention

**Migration:** Existing delegate-based filters can be wrapped with a thin adapter, or 
rewritten to the simpler `transform()` interface. External API unchanged.

---

## Secondary Problem: Redundant Tag Queries

In the current delegate-chain architecture, each filter strategy independently queries
for card tags, resulting in redundant database operations.

### Current Flow (Delegate Pattern)

```
RelativePriority.getWeightedCards()
  → InterferenceMitigator.getWeightedCards()
    → HierarchyDefinition.getWeightedCards()
      → ELO.getWeightedCards()
        → DB: getNewCards(), getPendingReviews(), getCardEloData()
```

Each filter then calls `course.getAppliedTags(cardId)` for every card:

```typescript
// In RelativePriority
const cardTags = await this.course.getAppliedTags(card.cardId);

// In InterferenceMitigator  
const cardTags = await this.course.getAppliedTags(card.cardId);

// In HierarchyDefinition
const cardTags = await this.course.getAppliedTags(card.cardId);
```

**Result:** For N cards through 3 filters = 3N tag lookups, when 1N would suffice.

### What's NOT a Problem

- The delegate chain itself is fine — delegates are lazily initialized and cached
- ELO's DB operations run once per `getWeightedCards()` call
- The candidate list flows up through the chain correctly

---

## Proposed Solutions

### Option A: Hydrate Tags in WeightedCard (Low Effort)

Extend `WeightedCard` to optionally carry tag data:

```typescript
interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;
  source: 'new' | 'review' | 'failed';
  
  /** 
   * Pre-fetched tags for this card.
   * If present, filters should use this instead of querying.
   */
  tags?: string[];
}
```

**Implementation:**

1. Generator (ELO) fetches tags in batch after getting candidates
2. Attaches tags to each `WeightedCard`
3. Filters check for `card.tags` before calling `getAppliedTags()`

```typescript
// In ELONavigator.getWeightedCards()
const candidates = [...scoredNew, ...scoredReviews];

// Batch fetch tags
const allCardIds = candidates.map(c => c.cardId);
const tagsByCard = await this.course.getAppliedTagsBatch(allCardIds);

// Attach to cards
return candidates.map(c => ({
  ...c,
  tags: tagsByCard.get(c.cardId) ?? []
}));
```

```typescript
// In filter strategies
const cardTags = card.tags ?? await this.course.getAppliedTags(card.cardId);
```

**Pros:**
- Minimal refactoring
- Backward compatible (tags optional)
- Filters don't need to change much

**Cons:**
- Still uses delegate pattern (some overhead)
- Tags travel through the whole chain even if only one filter needs them

---

### Option B: Pipeline Architecture (Clean Long-Term)

Replace nested delegates with an explicit pipeline:

```typescript
interface StrategyPipeline {
  /** Generator strategy — fetches and scores initial candidates */
  generator: ContentNavigator;
  
  /** Filter strategies — transform candidates in sequence */
  filters: StrategyFilter[];
}

interface StrategyFilter {
  /** Transform a pre-hydrated candidate list */
  transformCandidates(
    candidates: HydratedCard[], 
    context: FilterContext
  ): Promise<HydratedCard[]>;
}

interface HydratedCard extends WeightedCard {
  tags: string[];
  // Future: other pre-fetched data
}

interface FilterContext {
  user: UserDBInterface;
  course: CourseDBInterface;
  userElo: CourseElo;
  // Shared context, fetched once
}
```

**Execution:**

```typescript
class PipelineExecutor {
  async execute(pipeline: StrategyPipeline, limit: number): Promise<WeightedCard[]> {
    // 1. Generate candidates
    let candidates = await pipeline.generator.getWeightedCards(limit * 2);
    
    // 2. Hydrate with shared data (one batch)
    const hydratedCandidates = await this.hydrate(candidates);
    
    // 3. Build shared context (one fetch)
    const context = await this.buildContext();
    
    // 4. Run through filters
    for (const filter of pipeline.filters) {
      hydratedCandidates = await filter.transformCandidates(hydratedCandidates, context);
    }
    
    // 5. Return top results
    return hydratedCandidates.slice(0, limit);
  }
  
  private async hydrate(candidates: WeightedCard[]): Promise<HydratedCard[]> {
    const cardIds = candidates.map(c => c.cardId);
    const tagsByCard = await this.course.getAppliedTagsBatch(cardIds);
    
    return candidates.map(c => ({
      ...c,
      tags: tagsByCard.get(c.cardId) ?? []
    }));
  }
}
```

**Pros:**
- Clean separation of concerns
- Single hydration pass
- Shared context avoids repeated user/course queries
- Easier to add new hydration (e.g., card difficulty, history)

**Cons:**
- More refactoring
- New interface (`StrategyFilter.transformCandidates`)
- Existing filter strategies need migration

---

### Option C: Memoized Tag Lookup (Minimal Change)

Add a request-scoped cache for tag lookups:

```typescript
class TagCache {
  private cache = new Map<string, string[]>();
  
  async getAppliedTags(course: CourseDBInterface, cardId: string): Promise<string[]> {
    if (!this.cache.has(cardId)) {
      this.cache.set(cardId, await course.getAppliedTags(cardId));
    }
    return this.cache.get(cardId)!;
  }
}
```

Pass cache through the delegate chain or use a context object.

**Pros:**
- Minimal code change
- Works with existing architecture

**Cons:**
- Cache lifetime management
- Still sequential queries (not batched)
- Doesn't scale to other hydration needs

---

## Recommendation

**Phase 1:** Implement Option A (hydrate tags in WeightedCard)
- Quick win, reduces 3N → 1N queries
- Backward compatible
- Unblocks performance concerns

**Phase 2:** Consider Option B (pipeline architecture) when:
- Adding more shared hydration needs
- Implementing the Orchestrator (which naturally coordinates strategies)
- Refactoring for evolutionary selection (strategies need cleaner interfaces)

---

## Implementation Plan (Option A)

### Step 1: Add batch tag lookup method

```typescript
// In CourseDBInterface
getAppliedTagsBatch(cardIds: string[]): Promise<Map<string, string[]>>;
```

### Step 2: Update WeightedCard type

```typescript
interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;
  source: 'new' | 'review' | 'failed';
  tags?: string[];  // NEW: optional pre-fetched tags
}
```

### Step 3: Update ELONavigator

Batch fetch tags and attach to cards in `getWeightedCards()`.

### Step 4: Update filter strategies

Check for `card.tags` before querying:

```typescript
const cardTags = card.tags ?? await this.course.getAppliedTags(card.cardId);
```

### Step 5: Add tests

- Verify tags are populated by generator
- Verify filters use pre-fetched tags
- Verify fallback works if tags missing

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/db/src/core/navigators/index.ts` | Add `tags?` to WeightedCard |
| `packages/db/src/core/interfaces/courseDB.ts` | Add `getAppliedTagsBatch()` |
| `packages/db/src/impl/couch/courseDB.ts` | Implement `getAppliedTagsBatch()` |
| `packages/db/src/core/navigators/elo.ts` | Batch fetch and attach tags |
| `packages/db/src/core/navigators/hierarchyDefinition.ts` | Use `card.tags` if available |
| `packages/db/src/core/navigators/interferenceMitigator.ts` | Use `card.tags` if available |
| `packages/db/src/core/navigators/relativePriority.ts` | Use `card.tags` if available |

---

## Performance Expectations

| Scenario | Before | After (Option A) |
|----------|--------|------------------|
| 20 cards, 3 filters | 60 tag queries | 20 tag queries (batched) |
| 50 cards, 4 filters | 200 tag queries | 50 tag queries (batched) |

Batch queries are also more efficient than individual queries due to reduced round-trip overhead.

---

## Related Documents

- `packages/db/docs/navigators-architecture.md` — Current architecture
- `packages/db/docs/todo-naive-orchestration.md` — Pipeline assembly (current implementation)
- `todo-evolutionary-orchestration.md` — Future orchestrator (may subsume pipeline)
- `todo-provenance.md` — Audit trail (may benefit from hydration)