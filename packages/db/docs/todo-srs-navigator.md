# TODO: SRS Navigator Migration

## Status: NOT STARTED

## Goal

Extract SRS (Spaced Repetition System) logic into a proper `ContentNavigator` implementation
that scores review cards by overdueness, rather than treating all reviews as score=1.0.

## Current State

SRS functionality is currently **distributed across multiple components**:

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `SrsService` | `packages/db/src/study/services/SrsService.ts` | Scheduling algorithm, review interval calculation |
| `UserDBInterface.getPendingReviews()` | `packages/db/src/core/interfaces/userDB.ts` | Retrieves scheduled cards from userDB |
| `ScheduledCard` | `packages/db/src/core/types/user.ts` | Data structure for scheduled reviews |
| `ELONavigator.getPendingReviews()` | `packages/db/src/core/navigators/elo.ts` | Passes through user's pending reviews |
| `ELONavigator.getWeightedCards()` | `packages/db/src/core/navigators/elo.ts` | Assigns score=1.0 to all reviews |

## The Problem

Currently in `ELONavigator.getWeightedCards()`:

```typescript
// Score reviews (for now, score=1.0; future: score by overdueness)
const scoredReviews: WeightedCard[] = reviews.map((r) => ({
  cardId: r.cardID,
  courseId: r.courseID,
  score: 1.0,  // <-- All reviews get same score!
  source: 'review' as const,
}));
```

This means:
- Reviews always outrank new cards with score < 1.0
- No prioritization of "more overdue" vs "barely due" reviews
- Lost opportunity for smarter review ordering

## Proposed Solution

Create an `SRSNavigator` that:
1. Generates review candidates from `user.getPendingReviews()`
2. Scores them by **overdueness** (how far past their scheduled review time)
3. Can be composed with other strategies via delegate pattern

### Score Formula Options

**Option A: Linear overdueness**
```typescript
// Days overdue, clamped to reasonable range
const daysOverdue = moment.utc().diff(moment.utc(review.reviewTime), 'days');
const score = Math.min(1.0, 0.5 + (daysOverdue * 0.1)); // 0.5 base + 0.1 per day overdue
```

**Option B: Exponential urgency**
```typescript
const hoursOverdue = moment.utc().diff(moment.utc(review.reviewTime), 'hours');
const urgency = 1 - Math.exp(-hoursOverdue / 24); // Approaches 1.0 asymptotically
const score = 0.5 + (urgency * 0.5);
```

**Option C: Configurable**
```typescript
interface SRSConfig {
  baseScore: number;           // Score for reviews exactly on time (default: 0.7)
  overdueBoostPerDay: number;  // Additional score per day overdue (default: 0.05)
  maxScore: number;            // Cap (default: 1.0)
  includeNewCards: boolean;    // Whether to also generate new cards (default: false)
  delegateStrategy?: string;   // For new cards if included
}
```

## Implementation Plan

### Phase 1: Create SRSNavigator

1. Create `packages/db/src/core/navigators/srs.ts`
2. Extend `ContentNavigator`
3. Implement `getWeightedCards()` with overdueness scoring
4. Implement legacy methods (`getPendingReviews()`, `getNewCards()`)
5. Add to `Navigators` enum

### Phase 2: Configuration

```typescript
interface SRSConfig {
  baseScore: number;           // default: 0.7
  overdueBoostPerDay: number;  // default: 0.05
  maxScore: number;            // default: 1.0
}
```

### Phase 3: Composition

SRS can be used as:
- **Standalone generator**: Just returns scored reviews
- **Part of a chain**: `RelativePriority(Interference(Hierarchy(SRS)))`
- **Merged with ELO**: Combine ELO's new card generation with SRS's review scoring

### Phase 4: Update ELONavigator

Two options:
- **Option A**: ELONavigator delegates review scoring to SRSNavigator
- **Option B**: ELONavigator focuses only on new cards, SRS is separate

Recommendation: Option B is cleaner separation of concerns.

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `packages/db/src/core/navigators/srs.ts` | CREATE | New SRSNavigator implementation |
| `packages/db/src/core/navigators/index.ts` | MODIFY | Add `SRS = 'srs'` to Navigators enum |
| `packages/db/src/core/navigators/elo.ts` | MODIFY | Option B: Remove review handling, focus on new cards |
| `packages/db/tests/core/navigators/navigators.test.ts` | MODIFY | Add SRS scoring tests |

## Test Cases

1. **On-time review** → base score (e.g., 0.7)
2. **1 day overdue** → base + boost (e.g., 0.75)
3. **7 days overdue** → higher score (e.g., 0.85 or capped at 1.0)
4. **Future review** (not yet due) → should not be returned
5. **Multiple reviews** → sorted by overdueness score descending

## Dependencies

- `moment` for date calculations (already used in codebase)
- `ScheduledCard.reviewTime` field for due time

## Open Questions

1. Should reviews that aren't due yet be excluded entirely, or get a low score?
2. Should there be a "stale" penalty for reviews that are VERY overdue (forgotten)?
3. How does this interact with the "failed cards" queue in SessionController?

## Related Files

- `packages/db/src/study/services/SrsService.ts` — Scheduling algorithm
- `packages/db/src/core/types/user.ts` — ScheduledCard type
- `packages/db/src/core/navigators/elo.ts` — Current review handling
- `packages/db/docs/navigators-architecture.md` — Architecture overview