# Assessment: SRS Navigator and ELO-Informed Review Scoring

## Summary

The request is to:
1. Create a new SRS generator navigator
2. Change default behavior (no configured navigators) to use a composite of ELO + SRS generators
3. Enable ELO-based filtering to inform SRS resurfacing (cross-strategy coordination)

## Key Constraint: Pipeline Refactor Direction

Per `todo-pipeline-optimization.md`, the project is moving **away from delegate chaining**:

**Current (complex):**
```
Filter3(delegate=Filter2(delegate=Filter1(delegate=Generator)))
```

**Target (simpler):**
```
cards = Generator.getWeightedCards()
cards = Filter1.transform(cards)
cards = Filter2.transform(cards)
cards = Filter3.transform(cards)
```

This means: **don't add new delegate-based filters**. Instead, filters should be pure 
transforms on a `WeightedCard[]` list.

## Current State Analysis

### SRS Functionality is Distributed

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `SrsService` | `study/services/SrsService.ts` | Scheduling algorithm (when to next review) |
| `UserDBInterface.getPendingReviews()` | `core/interfaces/userDB.ts` | Retrieves scheduled cards from userDB |
| `ScheduledCard` | `core/types/user.ts` | Data structure with `reviewTime`, `cardId`, `courseId` |
| `SpacedRepetition.ts` | `study/SpacedRepetition.ts` | `newInterval()` - calculates next interval based on history |
| `ELONavigator.getPendingReviews()` | `core/navigators/elo.ts` | Passes through user's pending reviews |
| `ELONavigator.getWeightedCards()` | `core/navigators/elo.ts` | Assigns `score=1.0` to all reviews (the problem!) |

### The Scoring Problem

Currently in `ELONavigator.getWeightedCards()`:
```typescript
// Score reviews (for now, score=1.0; future: score by overdueness)
const scoredReviews: WeightedCard[] = reviews.map((r) => ({
  cardId: r.cardID,
  courseId: r.courseID,
  score: 1.0,  // <-- All reviews get same score!
  ...
}));
```

This means:
- All reviews outrank any new card with `score < 1.0`
- No prioritization of "very overdue" vs "barely due"
- No opportunity for ELO-based adjustments to review priority

### Default Navigator Behavior

In `courseDB.createNavigator()`:
- If no `NAVIGATION_STRATEGY` documents exist → uses default ELO
- If strategies exist → assembles pipeline via `PipelineAssembler`
- `CompositeGenerator` exists for merging multiple generators

## The Cross-Strategy Coordination Challenge

The request mentions:
> we want ELO based *filtering* to inform SRS based resurfacing
> eg, a scheduled card that the user has 'moved beyond' should be penalized

Given the pipeline refactor direction, this becomes easier. We need:
1. Generators produce candidates (ELO for new cards, SRS for reviews)
2. A Pipeline class that applies filters as transforms
3. An ELO distance filter as a pure transform function

### Options for ELO + SRS Coordination

#### Option A: Embed ELO Adjustment in SRS (Rejected)

```typescript
// In SRSNavigator.getWeightedCards()
const overdueScore = this.computeOverdueScore(review);
const eloModifier = computeEloModifier(cardElo, userElo);
return overdueScore * eloModifier;
```

**Rejected because:**
- Couples SRS to ELO (breaks single responsibility)
- Can't configure ELO filtering independently
- Harder to reason about score contributions

#### Option B: Pipeline with ELO Distance Transform (Recommended)

Implement the pipeline architecture from `todo-pipeline-optimization.md` as part of this work:

```typescript
interface CardFilter {
  transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]>;
}

class Pipeline {
  constructor(
    private generator: ContentNavigator,  // or CompositeGenerator
    private filters: CardFilter[]
  ) {}

  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    let cards = await this.generator.getWeightedCards(limit * 2);
    
    for (const filter of this.filters) {
      cards = await filter.transform(cards, this.context);
    }
    
    return cards.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
```

Then `ELODistanceFilter` is just a transform:

```typescript
const eloDistanceFilter: CardFilter = {
  async transform(cards, context): Promise<WeightedCard[]> {
    const { userElo, course } = context;
    const cardElos = await course.getCardEloData(cards.map(c => c.cardId));
    
    return cards.map((card, i) => {
      const distance = Math.abs(cardElos[i].global.score - userElo);
      const modifier = distance < 100 ? 1.0
                     : distance < 300 ? 0.9
                     : distance < 500 ? 0.7
                     : 0.5;
      
      return {
        ...card,
        score: card.score * modifier,
        provenance: [...card.provenance, {
          strategy: 'eloDistance',
          strategyName: 'ELO Distance Filter',
          strategyId: 'ELO_DISTANCE_FILTER',
          action: modifier < 1 ? 'penalized' : 'passed',
          score: card.score * modifier,
          reason: `ELO distance ${Math.round(distance)} → ${modifier}x`
        }]
      };
    });
  }
};
```

**Pros:**
- Aligns with planned architecture direction
- No delegate wrapping needed
- Clean separation of concerns
- Easy to add/remove/reorder filters
- Natural place to hydrate shared data (tags, ELO) before filter pass

**Cons:**
- Requires implementing the Pipeline class (but we need it anyway)
- Existing delegate-based filters need thin adapters

## Implementation Breakdown

### Phase 1: SRS Generator (standalone, no ELO coordination)

1. Create `packages/db/src/core/navigators/srs.ts`
2. Implement `getWeightedCards()` with overdueness scoring
3. Add `SRS = 'srs'` to `Navigators` enum
4. Register as generator in `NavigatorRoles`

Scoring formula:
```typescript
const now = moment.utc();
const due = moment.utc(review.reviewTime);
const hoursOverdue = now.diff(due, 'hours');

if (hoursOverdue < 0) {
  // Not yet due - shouldn't be returned by getPendingReviews, but guard anyway
  return 0;
}

// Score increases with overdueness, asymptotically approaching 1.0
// Base score 0.6 at exactly due, approaching 0.95 at 7+ days overdue
const urgency = 1 - Math.exp(-hoursOverdue / 48); // 48h half-life
const score = 0.6 + (urgency * 0.35);
return Math.min(0.95, score); // Cap below 1.0 to allow filters to boost
```

### Phase 2: Pipeline Architecture

Implement the simpler pipeline model (per `todo-pipeline-optimization.md`):

1. Create `packages/db/src/core/navigators/Pipeline.ts`:
   - Takes a generator (or CompositeGenerator) and list of filters
   - Filters are pure transforms: `transform(cards, context) → cards`
   - Implements `StudyContentSource` for backward compat

2. Create `CardFilter` interface:
   ```typescript
   interface CardFilter {
     name: string;
     transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]>;
   }
   
   interface FilterContext {
     user: UserDBInterface;
     course: CourseDBInterface;
     userElo: number;
   }
   ```

3. Adapt existing delegate-based filters with thin wrappers (or rewrite).

### Phase 3: Default Composite + ELO Distance Filter

1. Modify `courseDB.createNavigator()`:
   - When no strategies configured, create:
     ```typescript
     new Pipeline(
       new CompositeGenerator([eloNavigator, srsNavigator]),
       [eloDistanceFilter]  // pure transform
     )
     ```

2. Create `eloDistanceFilter` as a `CardFilter`:
   - Penalizes cards far from user's current ELO
   - Applies to both new cards AND reviews
   - Configurable thresholds

### Phase 4: Migrate Existing Filters (Future)

Convert existing delegate-based filters to pure transforms:
- `hierarchyDefinition` → `hierarchyFilter`
- `interferenceMitigator` → `interferenceFilter`
- `relativePriority` → `priorityFilter`

This is lower priority — existing filters work, just with delegate overhead.

## Open Questions

1. **Should reviews not yet due be returned with score=0, or excluded entirely?**
   - Current `getPendingReviews()` likely filters them out already
   - Recommend: exclude (no score=0 pollution)

2. **What about "stale" cards (very overdue, likely forgotten)?**
   - Could cap overdueness benefit at e.g. 14 days
   - Or: let ELODistanceFilter handle it (user has progressed, card is now "behind")

3. **How does this interact with failed cards queue?**
   - SessionController has a separate "failed" queue
   - SRS generator should probably not include cards that are in-session failures
   - May need to pass session state to navigator (future enhancement)

## Recommendation

**Proceed with Option B: Pipeline + Pure Transforms**

This bundles the pipeline refactor with the SRS work because:
1. We need a non-delegate way to apply ELO filtering anyway
2. The pipeline refactor is small and well-defined
3. Doing both together avoids adding tech debt (delegate-based filters we'll remove)

Implementation order:
1. **Phase 1: SRS Generator** - immediate value, no breaking changes
2. **Phase 2: Pipeline class** - enables pure transform filters
3. **Phase 3: Default behavior** - `Pipeline(Composite(ELO, SRS), [eloDistance])`

This approach:
- Aligns with planned architecture direction
- Avoids adding delegate-based filters that we'd remove later
- Clean separation of concerns
- Incrementally deliverable (each phase is useful independently)

## Scope Consideration

If Phase 2 feels like scope creep, we could:
- **Minimal:** Just do Phase 1 (SRS generator) + update default to Composite(ELO, SRS)
- **Skip ELO filtering for now:** Reviews scored by overdueness only
- **Add ELO filtering later** when Pipeline exists

This defers the "ELO-informed SRS" requirement but delivers value sooner.