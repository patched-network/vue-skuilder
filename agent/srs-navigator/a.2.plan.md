# Plan: SRS Navigator + Pipeline Refactor

## Selected Approach

**Option A from Assessment:** Extract SRS logic into a dedicated generator, implement the
simpler Pipeline architecture, and deprecate the delegate-wrapping mechanism.

## Goals

1. Create `SRSNavigator` - a generator that scores reviews by overdueness
2. Create `Pipeline` class - replaces delegate chaining with simple sequential transforms
3. Create `CardFilter` interface - pure transform functions for filters
4. Update default behavior - `Pipeline(Composite(ELO, SRS), [eloDistanceFilter])`
5. Adapt existing filters to the new interface
6. Deprecate delegate pattern in existing filters

## Architecture Overview

### Current (Delegate Chaining)

```
Filter3(delegate=Filter2(delegate=Filter1(delegate=Generator)))
```

Each filter:
- Has `getDelegate()` that lazily creates wrapped strategy
- Calls `delegate.getWeightedCards()` then transforms
- Parses `serializedData.delegateStrategy` to know what to wrap

### Target (Pipeline)

```typescript
class Pipeline implements StudyContentSource {
  constructor(
    private generator: ContentNavigator,  // or CompositeGenerator
    private filters: CardFilter[],
    private context: FilterContext
  ) {}

  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // 1. Generate candidates
    let cards = await this.generator.getWeightedCards(limit * 2);
    
    // 2. Apply filters sequentially
    for (const filter of this.filters) {
      cards = await filter.transform(cards, this.context);
    }
    
    // 3. Sort and limit
    return cards.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
```

Each filter:
- Is a pure transform: `transform(cards, context) → cards`
- No delegate, no `serializedData.delegateStrategy`
- Receives shared context (user, course, userElo)

## Implementation Details

### New Files

| File | Purpose |
|------|---------|
| `core/navigators/srs.ts` | SRS generator - scores reviews by overdueness |
| `core/navigators/Pipeline.ts` | Pipeline executor - runs generator + filters |
| `core/navigators/filters/types.ts` | `CardFilter` interface, `FilterContext` |
| `core/navigators/filters/eloDistance.ts` | ELO distance filter (pure transform) |

### Modified Files

| File | Change |
|------|--------|
| `core/navigators/index.ts` | Add `SRS` to `Navigators` enum, export `CardFilter` |
| `impl/couch/courseDB.ts` | Update `createNavigator()` to use Pipeline for defaults |
| `core/navigators/PipelineAssembler.ts` | Output `Pipeline` instead of delegate chain |
| `core/navigators/hierarchyDefinition.ts` | Add `toFilter()` adapter method |
| `core/navigators/interferenceMitigator.ts` | Add `toFilter()` adapter method |
| `core/navigators/relativePriority.ts` | Add `toFilter()` adapter method |

### SRS Generator Implementation

**Scoring semantics:** Higher score = higher utility for presentation now.

Two factors determine urgency:
1. **Overdueness** - how far past the scheduled review time
2. **Interval recency** - shorter scheduled intervals indicate "novel content in progress"

A card with a 3-day interval that's 2 days overdue is more urgent than a card with 
a 6-month interval that's 2 days overdue. The shorter interval represents active 
learning at higher resolution.

```typescript
// core/navigators/srs.ts
export default class SRSNavigator extends ContentNavigator {
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    const reviews = await this.user.getPendingReviews(this.course.getCourseID());
    const now = moment.utc();
    
    // Filter to only cards that are actually due
    const dueReviews = reviews.filter(r => now.isAfter(moment.utc(r.reviewTime)));
    
    return dueReviews.map(review => {
      const scheduledAt = moment.utc(review.scheduledAt);
      const due = moment.utc(review.reviewTime);
      
      // Interval = time between scheduling and due date
      const intervalHours = Math.max(1, due.diff(scheduledAt, 'hours'));
      const hoursOverdue = now.diff(due, 'hours');
      
      // Relative overdueness: how overdue relative to the interval
      // 2 days overdue on a 3-day interval = 0.67 relative
      // 2 days overdue on a 180-day interval = 0.01 relative
      const relativeOverdue = hoursOverdue / intervalHours;
      
      // Interval recency factor: shorter intervals = more urgent
      // 24h interval → 1.0, 720h (30 days) → 0.5, longer → approaches 0.3
      const recencyFactor = 0.3 + 0.7 * Math.exp(-intervalHours / 720);
      
      // Combined urgency: relative overdueness weighted by recency
      // Clamp relative overdue contribution to avoid runaway scores
      const overdueContribution = Math.min(1.0, relativeOverdue);
      const urgency = overdueContribution * 0.5 + recencyFactor * 0.5;
      
      // Final score: base 0.5 + urgency contribution
      const score = 0.5 + urgency * 0.45;
      
      return {
        cardId: review.cardId,
        courseId: review.courseId,
        score: Math.min(0.95, score),
        provenance: [{
          strategy: 'srs',
          strategyName: this.strategyName || 'SRS',
          strategyId: this.strategyId || 'NAVIGATION_STRATEGY-SRS-default',
          action: 'generated',
          score,
          reason: `${Math.round(hoursOverdue)}h overdue (interval: ${Math.round(intervalHours)}h, relative: ${relativeOverdue.toFixed(2)}), recency: ${recencyFactor.toFixed(2)}, review`
        }]
      };
    }).sort((a, b) => b.score - a.score).slice(0, limit);
  }
  
  // Legacy methods
  async getPendingReviews() { /* delegate to user.getPendingReviews */ }
  async getNewCards() { return []; } // SRS doesn't generate new cards
}
```

**Example scores:**
| Interval | Overdue | Relative | Recency | Score |
|----------|---------|----------|---------|-------|
| 3 days   | 2 days  | 0.67     | 0.93    | 0.87  |
| 30 days  | 2 days  | 0.07     | 0.65    | 0.68  |
| 180 days | 2 days  | 0.01     | 0.35    | 0.59  |
| 1 day    | 6 hours | 0.25     | 0.99    | 0.78  |

### CardFilter Interface

```typescript
// core/navigators/filters/types.ts
export interface FilterContext {
  user: UserDBInterface;
  course: CourseDBInterface;
  userElo: number;
  // Future: hydrated tags, etc.
}

export interface CardFilter {
  name: string;
  
  /**
   * Transform a list of weighted cards.
   * Pure function - no side effects, no delegate wrapping.
   */
  transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]>;
}
```

### ELO Distance Filter

```typescript
// core/navigators/filters/eloDistance.ts
export interface EloDistanceConfig {
  thresholds?: Array<{ distance: number; multiplier: number }>;
}

const DEFAULT_THRESHOLDS = [
  { distance: 100, multiplier: 1.0 },
  { distance: 300, multiplier: 0.9 },
  { distance: 500, multiplier: 0.7 },
  { distance: Infinity, multiplier: 0.5 }
];

export function createEloDistanceFilter(config?: EloDistanceConfig): CardFilter {
  const thresholds = config?.thresholds ?? DEFAULT_THRESHOLDS;
  
  return {
    name: 'ELO Distance Filter',
    
    async transform(cards, context): Promise<WeightedCard[]> {
      const cardElos = await context.course.getCardEloData(cards.map(c => c.cardId));
      
      return cards.map((card, i) => {
        const cardElo = cardElos[i]?.global?.score ?? 1000;
        const distance = Math.abs(cardElo - context.userElo);
        
        // Find applicable threshold
        const threshold = thresholds.find(t => distance < t.distance) 
                       ?? thresholds[thresholds.length - 1];
        const multiplier = threshold.multiplier;
        const newScore = card.score * multiplier;
        
        return {
          ...card,
          score: newScore,
          provenance: [...card.provenance, {
            strategy: 'eloDistance',
            strategyName: 'ELO Distance Filter',
            strategyId: 'ELO_DISTANCE_FILTER',
            action: multiplier < 1 ? 'penalized' : 'passed',
            score: newScore,
            reason: `ELO distance ${Math.round(distance)} → ${multiplier}x`
          }]
        };
      });
    }
  };
}
```

### Pipeline Class

```typescript
// core/navigators/Pipeline.ts
export class Pipeline implements StudyContentSource {
  constructor(
    private generator: ContentNavigator,
    private filters: CardFilter[],
    private user: UserDBInterface,
    private course: CourseDBInterface
  ) {}
  
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // Build context (once per call)
    const courseReg = await this.user.getCourseRegDoc(this.course.getCourseID());
    const userElo = toCourseElo(courseReg.elo).global.score;
    const context: FilterContext = { user: this.user, course: this.course, userElo };
    
    // Generate candidates
    let cards = await this.generator.getWeightedCards(limit * 2);
    
    // Apply filters
    for (const filter of this.filters) {
      cards = await filter.transform(cards, context);
    }
    
    // Sort and limit
    return cards
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  // Legacy methods - delegate to generator
  async getNewCards(n?: number) { return this.generator.getNewCards(n); }
  async getPendingReviews() { return this.generator.getPendingReviews(); }
}
```

### Default Navigator Update

```typescript
// In courseDB.createNavigator()
async createNavigator(user: UserDBInterface): Promise<ContentNavigator> {
  const allStrategies = await this.getAllNavigationStrategies();
  
  if (allStrategies.length === 0) {
    // NEW DEFAULT: Composite(ELO, SRS) with ELO distance filter
    const eloNav = new ELONavigator(user, this, this.makeDefaultEloStrategy());
    const srsNav = new SRSNavigator(user, this, this.makeDefaultSrsStrategy());
    const composite = new CompositeGenerator([eloNav, srsNav]);
    
    return new Pipeline(
      composite,
      [createEloDistanceFilter()],
      user,
      this
    );
  }
  
  // Existing assembly logic (eventually migrate to Pipeline)
  // ...
}
```

### Filter Adapter Pattern

For existing delegate-based filters, add a `toFilter()` method:

```typescript
// In HierarchyDefinitionNavigator
static toFilter(config: HierarchyConfig, strategyData: ContentNavigationStrategyData): CardFilter {
  return {
    name: strategyData.name || 'Hierarchy Definition',
    
    async transform(cards, context): Promise<WeightedCard[]> {
      // Same logic as getWeightedCards, but without delegate calls
      const navigator = new HierarchyDefinitionNavigator(
        context.user, context.course, strategyData
      );
      
      // Use internal methods directly
      const masteredTags = await navigator.getMasteredTags();
      const unlockedTags = navigator.getUnlockedTags(masteredTags);
      
      // Apply gating (same as current getWeightedCards body)
      return cards.map(card => /* ... */);
    }
  };
}
```

## ELO Navigator Changes

Remove review handling from ELONavigator (SRS now owns that):

```typescript
// In ELONavigator.getWeightedCards()
async getWeightedCards(limit: number): Promise<WeightedCard[]> {
  // REMOVED: const reviews = await this.getPendingReviews();
  // REMOVED: const scoredReviews = reviews.map(...);
  
  // Only handle new cards
  const newCards = await this.getNewCards(limit);
  // ... existing ELO scoring logic
  return scoredNew;
}
```

## Success Criteria

1. **SRS Navigator works standalone**
   - Returns reviews scored by overdueness
   - Higher score for more overdue cards
   - Cards not yet due excluded or score=0

2. **Pipeline works as replacement for delegate chains**
   - Same output as delegate chain for existing filters
   - Cleaner execution (no nested instantiation)

3. **Default behavior uses ELO+SRS composite**
   - New cards scored by ELO proximity
   - Reviews scored by overdueness
   - Both filtered by ELO distance

4. **Existing filters work via adapter**
   - `HierarchyDefinition.toFilter()` produces equivalent results
   - No behavior change for courses with configured strategies

5. **Deprecation warnings in place**
   - `getDelegate()` pattern marked deprecated
   - `delegateStrategy` in serializedData marked deprecated

## Known Risks

| Risk | Mitigation |
|------|------------|
| Behavior change for existing filters | Adapter pattern preserves semantics |
| Performance (context built per call) | Context is cheap; can memoize if needed |
| Filter order matters? | No - all filters are multipliers (commutative) |
| ELO looked up twice (generator + filter) | Accept for now; hydration pass in future |

## Phases / Task Chunks

### Phase 1: SRS Generator (standalone value) ✅ COMPLETED
- [x] p1.1: Create `core/navigators/srs.ts`
- [x] p1.2: Add `SRS` to `Navigators` enum in `index.ts`
- [x] p1.3: Add `NavigatorRole.GENERATOR` for SRS
- [x] p1.4: Unit tests for overdueness scoring (15 tests passing)

### Phase 2: Pipeline + CardFilter Infrastructure ✅ COMPLETED
- [x] p2.1: Create `core/navigators/filters/types.ts` (CardFilter, FilterContext)
- [x] p2.2: Create `core/navigators/Pipeline.ts`
- [x] p2.3: Implement `StudyContentSource` in Pipeline
- [x] p2.4: Unit tests for Pipeline (14 tests passing)

### Phase 3: ELO Distance Filter ✅ COMPLETED
- [x] p3.1: Create `core/navigators/filters/eloDistance.ts`
- [x] p3.2: Unit tests for distance thresholds (9 tests passing)

### Phase 4: Default Behavior Update ✅ COMPLETED
- [x] p4.1: Update `courseDB.createNavigator()` for no-strategy case
- [x] p4.2: Create `makeDefaultSrsStrategy()` helper
- [x] p4.3: Create `createDefaultPipeline()` helper
- [ ] p4.4: Integration test: default navigator returns both new + review cards (deferred to CI)

### Phase 5: ELO Navigator Cleanup ✅ COMPLETED
- [x] p5.1: Remove review handling from ELONavigator.getWeightedCards()
- [x] p5.2: Update provenance to say "new card" only (already was)
- [x] p5.3: Update tests (all 120 tests still passing)

### Phase 6: CardGenerator Interface + Generator Updates ✅ COMPLETED
- [x] p6.1: Create `core/navigators/generators/types.ts` with `CardGenerator` interface and `GeneratorContext`
- [x] p6.2: Update `ELONavigator` to implement `CardGenerator`
- [x] p6.3: Update `SRSNavigator` to implement `CardGenerator`
- [x] p6.4: Update `HardcodedOrderNavigator` to implement `CardGenerator`
- [x] p6.5: Export `CardGenerator` from `core/navigators/index.ts`
- [x] p6.6: Update `CompositeGenerator` to use `CardGenerator` interface
- [x] p6.7: Update `Pipeline` to use `CardGenerator` and pass context to generator
- [x] p6.8: Clean up delegate pattern references in index.ts comments (126 tests passing)

### Phase 7: Add CardFilter Interface to Existing Filters, Remove Delegate
- [ ] p7.1: Update `HierarchyDefinitionNavigator` to implement `CardFilter`
  - Add `implements CardFilter`
  - Add `transform()` method (extract logic from `getWeightedCards`)
  - Remove `getDelegate()`, `delegate` field, `delegateStrategy` config
  - Stub or remove legacy methods (`getNewCards`, `getPendingReviews`)
- [ ] p7.2: Update `InterferenceMitigatorNavigator` to implement `CardFilter`
  - Add `implements CardFilter`
  - Add `transform()` method (extract logic from `getWeightedCards`)
  - Remove `getDelegate()`, `delegate` field, `delegateStrategy` config
  - Stub or remove legacy methods
- [ ] p7.3: Update `RelativePriorityNavigator` to implement `CardFilter`
  - Add `implements CardFilter`
  - Add `transform()` method (extract logic from `getWeightedCards`)
  - Remove `getDelegate()`, `delegate` field, `delegateStrategy` config
  - Stub or remove legacy methods

### Phase 8: PipelineAssembler Rewrite
- [ ] p8.1: Update `PipelineAssembler` to instantiate generators and filters directly
  - Remove `buildChain()` method entirely
  - Return a `Pipeline` instance (not a strategy config for delegate wrapping)
- [ ] p8.2: Remove `delegateStrategy` handling from all config parsing
- [ ] p8.3: Update `NavigatorRoles` registry if needed (generators vs filters now type-enforced)

### Phase 9: Cleanup
- [ ] p9.1: Remove delegate pattern comments/docs from `core/navigators/index.ts`
- [ ] p9.2: Update `ContentNavigator` base class (remove delegate-related guidance)
- [ ] p9.3: Update navigators-architecture.md (if exists)
- [ ] p9.4: Update todo-pipeline-optimization.md (mark complete)
- [ ] p9.5: Verify all tests pass

## Out of Scope (Future)

- Batch tag hydration (per todo-pipeline-optimization.md)
- Filter reordering optimization
- Score normalization across generators (allow each to express natural internal logic)
- Evolutionary orchestrator integration

## Notes on Score Semantics

Currently there's no formal semantics for scores (what 0.5 vs 0.8 "means"). 
The current convention is:
- Higher = more suitable for presentation now
- 0.0 = hard filter (exclude)
- Multipliers are commutative (filter order doesn't matter)

Future consideration: normalize generator outputs so they can use natural internal 
representations (e.g., SRS could use raw urgency, ELO could use distance) and a 
normalization layer maps to comparable [0,1] scores for composition.