# Navigation Strategy Architecture

## Overview

This document describes the evolution of the NavigationStrategy API and provides guidance
for migrating from the legacy `getNewCards()` / `getPendingReviews()` interface to the new
unified `getWeightedCards()` API.

## Historical Context

### The Original Design

The `StudyContentSource` interface was originally conceived to abstract both 'classrooms'
and 'courses' as sources of study content. It exposed two methods:

```typescript
interface StudyContentSource {
  getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;
  getNewCards(n?: number): Promise<StudySessionNewItem[]>;
}
```

These methods were artifacts of two **hard-coded NavigationStrategies** (before they had
that name):

1. **ELO proximity** — for selecting new cards matched to user skill level
2. **SRS scheduling** — for surfacing cards due for review based on spaced repetition

The new/review split reflected this implementation detail, not a fundamental abstraction.

### The Problem

As we added more sophisticated navigation strategies, the limitations became apparent:

- **What does "get reviews" mean for an interference mitigator?** The concept doesn't map.
- **SRS is just one strategy** — it votes for scheduled reviews, but that preference could
  be expressed as weighted scores like any other strategy.
- **Some strategies generate candidates, others filter/score them** — the interface didn't
  accommodate this distinction.

### The Solution: Weighted Cards

The new API unifies card selection into a single scored candidate model:

```typescript
interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;      // 0-1 suitability
  source: 'new' | 'review' | 'failed';
}

abstract class ContentNavigator {
  // THE NEW PRIMARY API
  async getWeightedCards(limit: number): Promise<WeightedCard[]>;
  
  // LEGACY - kept for backward compatibility
  abstract getPendingReviews(): Promise<...>;
  abstract getNewCards(n?: number): Promise<...>;
}
```

## The Delegate Pattern

Navigation strategies fall into two categories:

### Generator Strategies
Generate candidate cards with scores based on their own logic.

- **ELO** — Generates cards near user skill level, scores by ELO distance
- **SRS** — Generates overdue reviews, scores by overdueness
- **HardcodedOrder** — Returns a fixed sequence of cards

### Filter/Decorator Strategies
Wrap a delegate strategy and transform its output.

- **HierarchyDefinition** — Filters out cards whose prerequisites aren't met
- **InterferenceMitigator** — Reduces scores for confusable content
- **RelativePriority** — Boosts scores for high-utility content

### Composition

Filter strategies wrap generators (or other filters) to form a pipeline:

```
RelativePriority(
  delegate=InterferenceMitigator(
    delegate=HierarchyDefinition(
      delegate=ELO)))
```

The flow:
1. **ELO** generates candidates scored by skill proximity
2. **HierarchyDefinition** gates locked cards (score=0 or passthrough)
3. **InterferenceMitigator** reduces scores for similar tags while immature
4. **RelativePriority** boosts high-utility content (common letters first)

**Note:** All filters apply score multipliers (including `score: 0` for exclusion).
This makes filter order irrelevant — multiplication is commutative.

## Pipeline Assembly (COMPLETE)

Pipeline assembly is now automatic based on `NAVIGATION_STRATEGY` documents in the course:

```typescript
// courseDB.createNavigator(user) assembles the pipeline:
// 1. Fetches all NAVIGATION_STRATEGY documents
// 2. Separates generators from filters
// 3. If multiple generators, wraps in CompositeGenerator
// 4. If no generator but filters exist, uses default ELO
// 5. Chains filters around generator(s)
```

**Key components:**

- `PipelineAssembler` — DB-agnostic assembly logic (`core/navigators/PipelineAssembler.ts`)
- `CompositeGenerator` — Merges multiple generators with frequency boost (`core/navigators/CompositeGenerator.ts`)
- `NavigatorRole` enum — Classifies navigators as generators or filters (`core/navigators/index.ts`)

**Filter convention:** All filters are score multipliers (including `score: 0` for hard exclusions).
This means filter order doesn't matter — they're applied alphabetically for determinism.

---

## Migration Path

### Phase 1: Parallel APIs (Current State)

Both APIs coexist:
- `getWeightedCards()` is the new primary API
- `getNewCards()` / `getPendingReviews()` remain for backward compatibility
- Default `getWeightedCards()` implementation delegates to legacy methods

### Phase 2: SessionController Integration (COMPLETE)

`SessionController` now calls `getWeightedCards()` when available:
- `prepareSession()` checks if sources support `getWeightedCards()`
- New `getWeightedContent()` method fetches scored candidates
- Hybrid approach: uses scores for ordering, full review data for queue population
- Fallback to legacy methods for sources without `getWeightedCards()`

The new/review distinction is preserved via `WeightedCard.source` field for queue routing.

Key files modified:
- `packages/db/src/study/SessionController.ts` — Added `getWeightedContent()`
- `packages/db/src/impl/couch/courseDB.ts` — Added `getWeightedCards()` delegation
- `packages/db/src/impl/couch/classroomDB.ts` — Added `getWeightedCards()` wrapper
- `packages/db/src/core/interfaces/contentSource.ts` — Added optional `getWeightedCards()`

### Phase 3: Deprecation (Future)

Once SessionController migration is complete:
- Legacy methods will be marked `@deprecated`
- New strategy implementations can skip implementing them (base class provides defaults)
- Eventually, legacy methods will be removed

## Score Semantics

Scores range from 0-1 with the following semantics:

| Score | Meaning |
|-------|---------|
| 1.0 | Fully suitable — strong candidate |
| 0.5 | Neutral — no preference |
| 0.0 | Hard filter — exclude from consideration |
| 0.x | Soft preference — proportional suitability |

Scores are typically combined multiplicatively when strategies are chained. A score of 0
from any strategy filters out the card entirely.

## SessionController Interaction

`SessionController` manages:
- **Time budgeting** — Stops session based on configured duration
- **Queue management** — Maintains separate queues for new/review/failed cards
- **Just-in-time fetching** — Requests small batches from sources as needed

The controller now (as of Phase 2):
1. Checks if sources support `getWeightedCards()` in `prepareSession()`
2. Calls `getWeightedContent()` which:
   - Fetches weighted cards for scoring information
   - Fetches full review data via `getPendingReviews()` (needed for `ScheduledCard` fields)
   - Builds a score lookup map from weighted results
   - Sorts reviews by their weighted scores
   - Adds new cards ordered by their weighted scores
3. Falls back to legacy `getScheduledReviews()` / `getNewCards()` if sources don't support the new API

Debug info now includes `api.mode` ('weighted' | 'legacy') to indicate which path is active.

## Interface Evolution Summary

```
BEFORE (hard-coded strategies):

StudyContentSource
├── getNewCards()       ← ELO-based selection
└── getPendingReviews() ← SRS-based scheduling

AFTER (pluggable strategies):

ContentNavigator implements StudyContentSource
├── getWeightedCards()  ← PRIMARY: unified scored candidates
├── getNewCards()       ← LEGACY: backward compat, eventually deprecated  
└── getPendingReviews() ← LEGACY: backward compat, eventually deprecated
```

## For Implementers

### Creating a New Generator Strategy

```typescript
class MyGeneratorNavigator extends ContentNavigator {
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // Generate and score candidates
    const candidates = await this.findCandidates(limit);
    return candidates.map(c => ({
      cardId: c.id,
      courseId: this.course.getCourseID(),
      score: this.computeScore(c),
      source: 'new',
    }));
  }

  // Legacy methods - can use base class default or implement
  async getNewCards(n?: number) { /* ... */ }
  async getPendingReviews() { /* ... */ }
}
```

### Creating a New Filter Strategy

```typescript
class MyFilterNavigator extends ContentNavigator {
  private delegate: ContentNavigator | null = null;
  
  private async getDelegate(): Promise<ContentNavigator> {
    if (!this.delegate) {
      this.delegate = await ContentNavigator.create(
        this.user, 
        this.course,
        { implementingClass: this.config.delegateStrategy || 'elo', ... }
      );
    }
    return this.delegate;
  }

  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    const delegate = await this.getDelegate();
    const candidates = await delegate.getWeightedCards(limit * 2);
    
    // Transform scores
    return candidates
      .map(c => ({ ...c, score: this.adjustScore(c) }))
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Legacy methods delegate through
  async getNewCards(n?: number) {
    return (await this.getDelegate()).getNewCards(n);
  }
  async getPendingReviews() {
    return (await this.getDelegate()).getPendingReviews();
  }
}
```

## Related Files

- `packages/db/src/core/interfaces/contentSource.ts` — `StudyContentSource` interface (with optional `getWeightedCards`)
- `packages/db/src/core/navigators/index.ts` — `ContentNavigator` base class, `WeightedCard`, `NavigatorRole`
- `packages/db/src/core/navigators/PipelineAssembler.ts` — Assembles strategy docs into pipeline
- `packages/db/src/core/navigators/CompositeGenerator.ts` — Merges multiple generators
- `packages/db/src/core/navigators/elo.ts` — Reference generator implementation
- `packages/db/src/core/navigators/hierarchyDefinition.ts` — Reference filter implementation
- `packages/db/src/core/navigators/interferenceMitigator.ts` — Interference avoidance filter
- `packages/db/src/core/navigators/relativePriority.ts` — Priority-based score boosting filter
- `packages/db/src/impl/couch/courseDB.ts` — `createNavigator()`, `getWeightedCards()` implementation
- `packages/db/src/impl/couch/classroomDB.ts` — `getWeightedCards()` wrapper for classrooms
- `packages/db/src/study/SessionController.ts` — Consumer of navigation strategies (`getWeightedContent()`)

## Related TODOs

- `todo-provenance.md` — Audit trail for surfaced content
- `todo-pipeline-optimization.md` — Batch tag lookups, future: eliminate delegate pattern
- `agent/orchestrator/todo-evolutionary-orchestration.md` — Future: multi-arm bandit selection
