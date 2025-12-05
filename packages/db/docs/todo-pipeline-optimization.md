# TODO: Pipeline Optimization - Batch Tag Hydration

## Status: NOT STARTED

## Problem

Each filter strategy independently queries for card tags, resulting in redundant database operations.

For N cards through 3 filters = 3N tag lookups, when N would suffice.

```typescript
// In HierarchyDefinitionNavigator
const tagResponse = await context.course.getAppliedTags(card.cardId);

// In InterferenceMitigatorNavigator  
const tagResponse = await context.course.getAppliedTags(card.cardId);

// In RelativePriorityNavigator
const tagResponse = await context.course.getAppliedTags(card.cardId);
```

## Proposed Solution: Hydrate Tags in WeightedCard

Extend `WeightedCard` to optionally carry pre-fetched tag data:

```typescript
interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;
  provenance: StrategyContribution[];
  
  /** Pre-fetched tags. If present, filters should use this instead of querying. */
  tags?: string[];
}
```

### Implementation Steps

#### Step 1: Add batch tag lookup method

```typescript
// In CourseDBInterface
getAppliedTagsBatch(cardIds: string[]): Promise<Map<string, string[]>>;
```

#### Step 2: Update WeightedCard type

Add optional `tags?: string[]` field to `WeightedCard` in `core/navigators/index.ts`.

#### Step 3: Hydrate in Pipeline

The `Pipeline` class should batch-fetch tags after getting candidates from the generator:

```typescript
async getWeightedCards(limit: number): Promise<WeightedCard[]> {
  const context = await this.buildContext();
  let cards = await this.generator.getWeightedCards(fetchLimit, context);
  
  // Batch hydrate tags
  cards = await this.hydrateTags(cards);
  
  for (const filter of this.filters) {
    cards = await filter.transform(cards, context);
  }
  
  return cards.filter(c => c.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, limit);
}

private async hydrateTags(cards: WeightedCard[]): Promise<WeightedCard[]> {
  const cardIds = cards.map(c => c.cardId);
  const tagsByCard = await this.course.getAppliedTagsBatch(cardIds);
  
  return cards.map(c => ({
    ...c,
    tags: tagsByCard.get(c.cardId) ?? []
  }));
}
```

#### Step 4: Update filter strategies

Each filter checks for pre-hydrated tags before querying:

```typescript
const cardTags = card.tags ?? await this.getCardTags(card.cardId, context.course);
```

#### Step 5: Add tests

- Verify tags are populated by Pipeline
- Verify filters use pre-fetched tags when available
- Verify fallback works if tags missing

## Files to Modify

| File | Change |
|------|--------|
| `core/navigators/index.ts` | Add `tags?` to `WeightedCard` |
| `core/interfaces/courseDB.ts` | Add `getAppliedTagsBatch()` |
| `impl/couch/courseDB.ts` | Implement `getAppliedTagsBatch()` |
| `impl/static/courseDB.ts` | Implement `getAppliedTagsBatch()` |
| `core/navigators/Pipeline.ts` | Add `hydrateTags()` step |
| `core/navigators/hierarchyDefinition.ts` | Use `card.tags` if available |
| `core/navigators/interferenceMitigator.ts` | Use `card.tags` if available |
| `core/navigators/relativePriority.ts` | Use `card.tags` if available |

## Performance Expectations

| Scenario | Before | After |
|----------|--------|-------|
| 20 cards, 3 filters | 60 tag queries | 1 batch query (20 cards) |
| 50 cards, 4 filters | 200 tag queries | 1 batch query (50 cards) |

Batch queries also reduce round-trip overhead compared to individual queries.