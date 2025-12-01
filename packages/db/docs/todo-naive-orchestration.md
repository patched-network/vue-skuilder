# TODO: Naive Orchestration (Pipeline Assembly)

## Status: NOT STARTED

## Overview

This document tracks the work needed to get navigation strategy pipelines working in
production, with testable e2e coverage. The goal is **naive orchestration**: assemble
configured navigators into a working pipeline, without the evolutionary/market dynamics
described in `todo-evolutionary-orchestration.md`.

### Key Design Decision: Filters Are Multipliers

All filter strategies apply **score multipliers** (including `score * 0` for hard exclusions).
This means filter ordering doesn't matter — multiplication is commutative.

Pipeline assembly becomes trivial:
1. Find the one generator among configured strategies
2. Wrap with all filters in any deterministic order (e.g., alphabetical)

See "Filter API Convention" section below for details.

---

## The Gap

### What Exists

| Component | Status | Location |
|-----------|--------|----------|
| `ContentNavigator` base class | ✅ Complete | `core/navigators/index.ts` |
| Generator: `ELONavigator` | ✅ Complete | `core/navigators/elo.ts` |
| Filter: `HierarchyDefinitionNavigator` | ✅ Complete | `core/navigators/hierarchyDefinition.ts` |
| Filter: `InterferenceMitigatorNavigator` | ✅ Complete | `core/navigators/interferenceMitigator.ts` |
| Filter: `RelativePriorityNavigator` | ✅ Complete | `core/navigators/relativePriority.ts` |
| `surfaceNavigationStrategy()` | ⚠️ Partial | `impl/couch/courseDB.ts` |
| `getAllNavigationStrategies()` | ✅ Complete | `impl/couch/courseDB.ts` |

### What's Missing

The delegate pattern is **implemented** in individual navigators but **never wired up**:

```typescript
// Current: surfaceNavigationStrategy() returns ONE strategy
async surfaceNavigationStrategy(): Promise<ContentNavigationStrategyData> {
  // 1. Try to load config.defaultNavigationStrategyId (doesn't exist!)
  // 2. Fall back to hard-coded ELO
  return hardCodedEloStrategy;
}
```

The collection of strategies (`getAllNavigationStrategies()`) is **never consulted**.

---

## Design Decision: Pipeline Configuration Model

### Approach: Pure Function of Existing Documents

The pipeline is derived from **all `NAVIGATION_STRATEGY` documents** in the course database.
No additional configuration in CourseConfig — avoids mixing static config with dynamic state.

```typescript
async assemblePipeline(): Promise<ContentNavigationStrategyData> {
  const allStrategies = await this.getAllNavigationStrategies();
  
  // 1. Separate generators from filters
  const generators = allStrategies.filter(s => isGenerator(s.implementingClass));
  const filters = allStrategies.filter(s => isFilter(s.implementingClass));
  
  // 2. Validate exactly one generator
  if (generators.length !== 1) {
    throw new Error(`Expected 1 generator, found ${generators.length}`);
  }
  
  // 3. Chain filters in deterministic order (alphabetical by name)
  const sortedFilters = filters.sort((a, b) => a.name.localeCompare(b.name));
  
  // 4. Build delegate chain: outermost filter wraps ... wraps generator
  return buildChain(generators[0], sortedFilters);
}
```

**Why this approach:**
- CourseConfig stays declarative (no runtime/dynamic state)
- Pipeline is observable: "what strategies exist" = "what pipeline runs"
- Adding/removing a strategy document changes behavior (no config sync needed)
- Ordering doesn't matter (see Filter API Convention below)

---

## Filter API Convention

### All Filters Are Score Multipliers

Filters transform scores but **never remove cards**. Hard exclusions use `score: 0`.

```typescript
// BAD: Hard filter (removes cards)
if (isUnlocked) {
  gated.push(card);
}
// Card is gone — downstream filters never see it

// GOOD: Score multiplier (score: 0 for exclusion)
adjusted.push({
  ...card,
  score: isUnlocked ? card.score : 0,
});
// Card remains in pipeline with score: 0
```

**Why this matters:**
- Multiplication is commutative: `a * b * c = c * a * b`
- Filter order doesn't matter
- Pipeline assembly is trivial (no ordering logic needed)
- Future provenance tracking can see all scores, including zeros

### Downstream Behavior

Cards with `score: 0` are:
- Sorted to the bottom by `SessionController`
- Never selected (we take top N by score)
- Functionally equivalent to filtering, but order-independent

### Required Change

`HierarchyDefinitionNavigator` currently hard-filters. Update to return `score: 0`:

```typescript
// In hierarchyDefinition.ts getWeightedCards()
for (const card of candidates) {
  const isUnlocked = await this.isCardUnlocked(card.cardId, unlockedTags);
  gated.push({
    ...card,
    score: isUnlocked ? card.score : 0,
  });
}
```

---

## Implementation Plan

### Phase 1: Filter API Normalization

#### 1.1 Update HierarchyDefinitionNavigator

Change from hard filter to score multiplier (return `score: 0` for locked cards).

### Phase 2: Strategy Classification

#### 2.1 Add Generator/Filter Classification

Navigators need to self-identify as generators or filters:

```typescript
// In packages/db/src/core/navigators/index.ts

export enum NavigatorRole {
  GENERATOR = 'generator',
  FILTER = 'filter',
}

// Add to Navigators enum or create parallel registry
export const NavigatorRoles: Record<Navigators, NavigatorRole> = {
  [Navigators.ELO]: NavigatorRole.GENERATOR,
  [Navigators.HARDCODED]: NavigatorRole.GENERATOR,
  [Navigators.HIERARCHY]: NavigatorRole.FILTER,
  [Navigators.INTERFERENCE]: NavigatorRole.FILTER,
  [Navigators.RELATIVE_PRIORITY]: NavigatorRole.FILTER,
};

export function isGenerator(impl: string): boolean {
  return NavigatorRoles[impl as Navigators] === NavigatorRole.GENERATOR;
}

export function isFilter(impl: string): boolean {
  return NavigatorRoles[impl as Navigators] === NavigatorRole.FILTER;
}
```

### Phase 3: Pipeline Assembly

#### 3.1 New Method: `assemblePipeline()`

```typescript
// In packages/db/src/impl/couch/courseDB.ts

/**
 * Assembles a navigation pipeline from all NAVIGATION_STRATEGY documents.
 * 
 * 1. Fetches all strategy documents via getAllNavigationStrategies()
 * 2. Separates into generators and filters
 * 3. Validates exactly one generator exists
 * 4. Chains filters around generator (order doesn't matter — all are multipliers)
 * 5. Returns outermost strategy config
 */
private async assemblePipeline(): Promise<ContentNavigationStrategyData | null> {
  const allStrategies = await this.getAllNavigationStrategies();
  
  if (allStrategies.length === 0) {
    return null; // Caller falls back to default ELO
  }
  
  // Separate generators from filters
  const generators = allStrategies.filter(s => isGenerator(s.implementingClass));
  const filters = allStrategies.filter(s => isFilter(s.implementingClass));
  
  // Validate exactly one generator
  if (generators.length === 0) {
    logger.warn('No generator strategy found, falling back to default');
    return null;
  }
  if (generators.length > 1) {
    throw new Error(
      `Expected 1 generator, found ${generators.length}: ${generators.map(g => g.name).join(', ')}`
    );
  }
  
  const generator = generators[0];
  
  if (filters.length === 0) {
    // Just the generator, no filters
    return generator;
  }
  
  // Sort filters alphabetically for deterministic ordering
  // (Order doesn't affect results since all filters are multipliers)
  const sortedFilters = filters.sort((a, b) => a.name.localeCompare(b.name));
  
  // Build delegate chain: last filter wraps ... wraps first filter wraps generator
  return this.buildChain(generator, sortedFilters);
}

private buildChain(
  generator: ContentNavigationStrategyData,
  filters: ContentNavigationStrategyData[]
): ContentNavigationStrategyData {
  // Each filter's serializedData gets delegateStrategy pointing to previous
  let previousImpl = generator.implementingClass;
  let outermost: ContentNavigationStrategyData = generator;
  
  for (const filter of filters) {
    // Parse existing config, inject delegateStrategy
    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(filter.serializedData || '{}');
    } catch {
      config = {};
    }
    config.delegateStrategy = previousImpl;
    
    outermost = {
      ...filter,
      serializedData: JSON.stringify(config),
    };
    previousImpl = filter.implementingClass;
  }
  
  return outermost;
}
```

#### 3.2 Update `surfaceNavigationStrategy()`

```typescript
async surfaceNavigationStrategy(): Promise<ContentNavigationStrategyData> {
  // Try assembled pipeline from existing strategy documents
  try {
    const assembled = await this.assemblePipeline();
    if (assembled) {
      logger.debug(`Using assembled pipeline: ${assembled.implementingClass}`);
      return assembled;
    }
  } catch (e) {
    logger.warn('Failed to assemble pipeline, falling back:', e);
  }
  
  // FALLBACK: Hard-coded ELO (no strategy documents exist)
  logger.debug('No strategy documents found, using default ELO');
  return this.makeHardcodedEloStrategy();
}
```

Note: The `defaultNavigationStrategyId` fallback is removed. Pipeline is now purely
derived from existing `NAVIGATION_STRATEGY` documents.

### Phase 4: Testing

#### 4.1 Unit Tests

```typescript
describe('assemblePipeline', () => {
  it('returns null when no strategy documents exist', async () => { ... });
  
  it('throws when multiple generators exist', async () => { ... });
  
  it('returns generator directly when no filters exist', async () => { ... });
  
  it('chains filters alphabetically around generator', async () => {
    // Given docs: [elo, relativePriority, hierarchyDefinition]
    // Sorted filters: [hierarchyDefinition, relativePriority]
    // Chain: relativePriority(delegate=hierarchy(delegate=elo))
  });
  
  it('preserves filter-specific config while injecting delegateStrategy', async () => {
    // Given: relativePriority doc with tagPriorities in serializedData
    // Expect: both tagPriorities and delegateStrategy in final serializedData
  });
});

describe('HierarchyDefinitionNavigator', () => {
  it('returns score: 0 for locked cards instead of filtering', async () => {
    // Given: card with unmet prerequisites
    // Expect: card in results with score: 0
  });
});
```

#### 4.2 E2E Tests

```typescript
describe('Navigation Pipeline E2E', () => {
  it('filters cards through hierarchy prerequisites', async () => {
    // Setup: course with hierarchy config requiring tag A before tag B
    // Setup: user has NOT mastered tag A
    // Action: getWeightedCards()
    // Expect: no cards with tag B appear
  });
  
  it('applies interference mitigation', async () => {
    // Setup: course with interference sets [a, b]
    // Setup: user just saw card with tag a
    // Action: getWeightedCards()
    // Expect: cards with tag b have reduced scores
  });
  
  it('boosts priority tags', async () => {
    // Setup: course with relativePriority config
    // Action: getWeightedCards()
    // Expect: high-priority tag cards rank higher
  });
  
  it('composes all three filters', async () => {
    // Full pipeline test
  });
});
```

### Phase 5: Migration & Defaults

#### 5.1 Default Behavior

Courses with no `NAVIGATION_STRATEGY` documents:
- `assemblePipeline()` returns null
- `surfaceNavigationStrategy()` returns hard-coded ELO

#### 5.2 Adding Strategies to Existing Courses

To enable a pipeline, add strategy documents:
1. Add one generator document (e.g., ELO strategy)
2. Add zero or more filter documents (hierarchy, interference, etc.)
3. Pipeline is automatically assembled on next `getWeightedCards()` call

No CourseConfig changes needed.

---

## Files to Modify

| File | Changes |
|------|---------|
| `core/navigators/index.ts` | Add `NavigatorRole` enum, registry, and helper functions |
| `core/navigators/hierarchyDefinition.ts` | Return `score: 0` instead of filtering |
| `impl/couch/courseDB.ts` | Add `assemblePipeline()`, `buildChain()`, simplify `surfaceNavigationStrategy()` |

## New Files

| File | Purpose |
|------|---------|
| `__tests__/pipeline.test.ts` | Unit tests for pipeline assembly |
| E2E test files | Integration tests for full pipeline |

---

## Relationship to Other TODOs

### Keeps Separate

- **Evolutionary orchestration** (`todo-evolutionary-orchestration.md`): Multi-arm bandit selection, cohort assignment, outcome measurement. This TODO is just "wire up configured strategies."

- **Strategy state storage** (`todo-strategy-state-storage.md`): Strategies persisting their own learned state. Not needed for naive orchestration.

### Keeps in Mind

The naive orchestration design should be **compatible with** future evolutionary features:

1. **Pipeline as unit of selection**: An assembled pipeline could be treated as a "strategy" for evolutionary purposes.

2. **Configurable at course level**: `navigationPipeline` in CourseConfig mirrors how evolutionary orchestration would configure strategy application.

3. **Composable filters**: The delegate pattern allows mixing manually-configured filters with future auto-generated ones.

4. **Observable**: Pipeline assembly logs which strategies are active, useful for future cohort tracking.

### Enables

- **Provenance** (`todo-provenance.md`): Once pipeline is working, can add audit trail.
- **Pipeline optimization** (`todo-pipeline-optimization.md`): Once pipeline is working, can optimize tag lookups.
- **E2E testing**: Foundation for testing strategy behaviors.

---

## Open Questions

1. **Where does pipeline assembly live?** 
   - Option A: In `CourseDB` (current sketch) ← likely winner
   - Option B: In a separate `PipelineAssembler` class
   >>> let's do this - we want to prepare some of the logic to be db-impl agnostic (eg, static DB), and also start preparing toward the dynamic navigator selection engine stuff, which will want its own isolated logic
   - Option C: In `ContentNavigator.create()` (polymorphic on config shape)

2. **Error recovery?**
   - If a filter fails to load, skip it? Use fallback pipeline? Fail entirely?
   >>> skip it, log warnings.
   - Current sketch: fail on multiple generators, warn and fallback on zero generators
   >>> sounds good.

3. **Alphabetical ordering sufficient?**
   - Works because filters are multipliers (order-independent)
   - If we ever need explicit ordering, add `order: number` field to strategy docs
    >>> just deferring this question for now.

---

## Success Criteria

Naive orchestration is **complete** when:

1. ✅ `HierarchyDefinitionNavigator` returns `score: 0` for locked cards
2. ✅ `assemblePipeline()` discovers strategy docs and chains them
3. ✅ Adding a filter strategy doc to a course changes card scoring
4. ✅ E2E tests verify pipeline composition
5. ✅ Fallback to ELO still works for courses with no strategy docs
6. ✅ At least one real course is using a multi-stage pipeline

---

## Related Documents

- `navigators-architecture.md` — Current architecture and delegate pattern
- `todo-evolutionary-orchestration.md` — Future: market dynamics and selection
- `todo-provenance.md` — Future: audit trail for surfaced content
- `todo-pipeline-optimization.md` — Future: batch tag lookups
