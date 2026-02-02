# Assessment: Nice-to-Have Extensions for Generator Balance

**Date**: 2026-02-02  
**Parent**: `a.1.assessment.md` (CompositeGenerator Score Balance)  
**Status**: Deferred extension work - document for future reference

---

## Overview

This document captures extension ideas surfaced during the main balance fix discussion. These are "nice to have" features that build on top of the backlog pressure mechanism.

---

## Extension 1: Orchestrator-Tuned Generator Weights

### Current State

The orchestration layer (`packages/db/src/core/orchestration/`) already supports learnable weights:

```typescript
interface LearnableWeight {
  weight: number;       // Peak value, 1.0 = neutral
  confidence: number;   // 0-1, controls exploration width
  sampleSize: number;   // Observations collected
}
```

When a strategy has `learnable` set and `staticWeight: false`, the orchestrator:
1. Distributes users across a weight range (bell curve around peak)
2. Records learning outcomes per user
3. Correlates user deviation with outcomes via gradient estimation
4. Updates peak weight toward observed optimum

### Application to Generator Balance

**Hypothesis**: The orchestrator can already tune the ELO vs SRS balance by experimenting with their weights.

In `CompositeGenerator.getWeightedCards()`, weights are applied:

```typescript
// Line ~160 in CompositeGenerator.ts
let weight = gen.learnable?.weight ?? 1.0;
if (gen.learnable && !gen.staticWeight && context.orchestration) {
  weight = context.orchestration.getEffectiveWeight(strategyId, gen.learnable);
}
```

So if SRS has `learnable: { weight: 1.0, confidence: 0.5, sampleSize: 0 }`, the orchestrator will try variations (0.8, 1.2, etc.) and correlate with learning outcomes.

### Required Work

1. **Ensure default strategies have learnable weights** - Check that ELO and SRS strategy documents include `learnable` config
2. **Verify outcome correlation** - Does the orchestrator track success/failure per card source?
3. **Consider weight bounds** - May want to constrain exploration (e.g., SRS weight ∈ [0.5, 2.0])

### Risk

- Orchestrator experiments could override backlog pressure intent
- May need to mark backlog-pressure-derived scores as non-learnable

### Recommendation

**Defer** - The backlog pressure mechanism should handle balance. Orchestrator tuning is a layer on top that can be enabled later by adding `learnable` to strategy documents.

---

## Extension 2: Per-User Review Urgency Adaptation

### Concept

Users have different memory characteristics. A "forgetful" user needs more review pressure; a "retentive" user needs less. Rather than one-size-fits-all, maintain a per-user `reviewUrgencyMultiplier` that adapts based on review outcomes.

### Proposed Mechanism

```typescript
interface UserReviewAdaptation {
  urgencyMultiplier: number;  // Default 1.0, range [0.5, 2.0]
  recentFailures: number;     // Rolling window count
  recentSuccesses: number;    // Rolling window count
  lastUpdated: string;        // ISO timestamp
}
```

**Update Rules**:
- On failed review: `multiplier = min(2.0, multiplier + 0.05)`
- On successful review: `multiplier = max(0.5, multiplier - 0.01)`

**Asymmetry rationale**: 
- Failures should increase pressure quickly (5x faster than decrease)
- Successes slowly reduce pressure (avoid death spiral from one good session)
- Equilibrium: User with 1:5 fail:success ratio stays at multiplier 1.0

### Application

In SRS urgency calculation:

```typescript
const userAdaptation = await this.getUserReviewAdaptation();
const adaptedUrgency = baseUrgency * userAdaptation.urgencyMultiplier;
const score = Math.min(1.0, 0.5 + adaptedUrgency * 0.45 + backlogPressure);
```

### Storage

Options:
1. **Strategy state** - Per-user, per-course, per-strategy storage already exists
2. **Course registration** - Add field to user's course reg doc
3. **User profile** - Global across all courses (probably not desired)

**Recommendation**: Use strategy state (option 1) - already supported, scoped correctly.

### Equilibrium Analysis

Let `m` = multiplier, `f` = failure rate

At equilibrium: `0.05 * f = 0.01 * (1-f)`
Solving: `0.05f = 0.01 - 0.01f`
`0.06f = 0.01`
`f = 0.167` (16.7% failure rate)

This means:
- User with 16.7% failure rate → multiplier stable at any level
- User with >16.7% failure rate → multiplier increases (more review pressure)
- User with <16.7% failure rate → multiplier decreases (less review pressure)

The 16.7% threshold can be tuned by adjusting increment/decrement rates.

### Implementation Sketch

```typescript
// In srs.ts

interface ReviewAdaptationState {
  urgencyMultiplier: number;
  windowStart: string;
  windowFailures: number;
  windowSuccesses: number;
}

private async getReviewAdaptation(): Promise<ReviewAdaptationState> {
  const state = await this.getStrategyState<ReviewAdaptationState>();
  return state || {
    urgencyMultiplier: 1.0,
    windowStart: new Date().toISOString(),
    windowFailures: 0,
    windowSuccesses: 0,
  };
}

// Called after review outcome recorded
async updateReviewAdaptation(success: boolean): Promise<void> {
  const state = await this.getReviewAdaptation();
  
  if (success) {
    state.urgencyMultiplier = Math.max(0.5, state.urgencyMultiplier - 0.01);
    state.windowSuccesses++;
  } else {
    state.urgencyMultiplier = Math.min(2.0, state.urgencyMultiplier + 0.05);
    state.windowFailures++;
  }
  
  await this.putStrategyState(state);
}
```

### Open Questions

1. **Who calls `updateReviewAdaptation`?** - Needs hook into card response recording
2. **Should multiplier affect backlog pressure or just base urgency?** - Probably just base urgency
3. **Reset on long breaks?** - User returning after 6 months might have different memory state
4. **Course-specific or global?** - Different subjects may have different difficulty

### Recommendation

**Implement after backlog pressure is stable** - This is a refinement that requires:
1. Hook into card response recording
2. Testing to validate equilibrium behavior
3. UX consideration (should user see their multiplier?)

---

## Priority Order

1. **Backlog Pressure** (main work) - Fixes immediate issue
2. **Per-User Adaptation** (extension 2) - High value, moderate complexity
3. **Orchestrator Tuning** (extension 1) - Lower value if backlog pressure works well

---

## Related Files

| File | Purpose |
|------|---------|
| `packages/db/src/core/navigators/generators/srs.ts` | SRS urgency calculation |
| `packages/db/src/core/orchestration/index.ts` | Orchestration context |
| `packages/db/src/core/types/contentNavigationStrategy.ts` | Strategy state types |