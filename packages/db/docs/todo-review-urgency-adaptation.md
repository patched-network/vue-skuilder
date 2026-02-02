# Future Work: Dynamic Review Urgency Adaptation

This document outlines planned extensions to the SRS backlog pressure system for adaptive review urgency tuning.

## Background

The SRS generator now implements **backlog pressure** — a mechanism that boosts review urgency when the number of due reviews exceeds a "healthy" threshold (default: 20). This ensures reviews don't pile up indefinitely while maintaining a healthy mix of new and review content.

See implementation: `core/navigators/generators/srs.ts`

This document describes two extension directions:
1. **Global/Orchestration Layer** — Course-wide tuning via learnable weights
2. **Per-User Adaptation** — Individual urgency multipliers based on review outcomes

---

## Extension 1: Orchestrator-Tuned Generator Weights

### Current State

The orchestration layer (`core/orchestration/`) already supports learnable weights:

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

### Application to Review Balance

The orchestrator can tune the ELO vs SRS balance by experimenting with their weights.

In `CompositeGenerator.getWeightedCards()`, weights are already applied:

```typescript
let weight = gen.learnable?.weight ?? 1.0;
if (gen.learnable && !gen.staticWeight && context.orchestration) {
  weight = context.orchestration.getEffectiveWeight(strategyId, gen.learnable);
}
```

If SRS has `learnable: { weight: 1.0, confidence: 0.5, sampleSize: 0 }`, the orchestrator will try variations (0.8, 1.2, etc.) and correlate with learning outcomes.

### Required Work

- [ ] Ensure default ELO and SRS strategy documents include `learnable` config
- [ ] Verify outcome correlation tracks success/failure per card source (generator provenance)
- [ ] Consider weight bounds (e.g., SRS weight ∈ [0.5, 2.0]) to prevent extreme tuning
- [ ] Test interaction with backlog pressure — may need to mark backlog-pressure-derived scores as non-learnable

### Risks

- Orchestrator experiments could override backlog pressure intent
- May need to separate "base urgency" (learnable) from "backlog pressure" (not learnable)

### Priority

**Low** — The backlog pressure mechanism should handle balance well. Orchestrator tuning is a refinement layer that can be enabled later.

---

## Extension 2: Per-User Review Urgency Adaptation

### Concept

Users have different memory characteristics. A "forgetful" user needs more review pressure; a "retentive" user needs less. Rather than one-size-fits-all, maintain a per-user `reviewUrgencyMultiplier` that adapts based on review outcomes.

### Proposed Data Model

```typescript
interface ReviewAdaptationState {
  urgencyMultiplier: number;  // Default 1.0, range [0.5, 2.0]
  windowStart: string;        // ISO timestamp for rolling window
  windowFailures: number;     // Failures in current window
  windowSuccesses: number;    // Successes in current window
  lastUpdated: string;        // ISO timestamp
}
```

### Update Rules

- On failed review: `multiplier = min(2.0, multiplier + 0.05)`
- On successful review: `multiplier = max(0.5, multiplier - 0.01)`

**Asymmetry rationale**:
- Failures increase pressure quickly (5x faster than decrease)
- Successes slowly reduce pressure (avoid death spiral from one good session)

### Equilibrium Analysis

At equilibrium: `0.05 * failRate = 0.01 * (1 - failRate)`

Solving: `failRate = 0.167` (16.7%)

This means:
- User with 16.7% failure rate → multiplier stable
- User with >16.7% failure rate → multiplier increases (more review pressure)
- User with <16.7% failure rate → multiplier decreases (less review pressure)

The equilibrium threshold can be tuned by adjusting increment/decrement rates.

### Application in Scoring

In SRS urgency calculation:

```typescript
const userAdaptation = await this.getReviewAdaptation();
const adaptedUrgency = baseUrgency * userAdaptation.urgencyMultiplier;
const score = Math.min(1.0, 0.5 + adaptedUrgency * 0.45 + backlogPressure);
```

Note: multiplier affects base urgency, not backlog pressure. This preserves the global backlog escape mechanism.

### Storage

Use strategy state storage (per-user, per-course, per-strategy):

```typescript
const state = await this.getStrategyState<ReviewAdaptationState>();
await this.putStrategyState({ ...state, urgencyMultiplier: newValue });
```

### Implementation Sketch

```typescript
// In srs.ts

private async getReviewAdaptation(): Promise<ReviewAdaptationState> {
  const state = await this.getStrategyState<ReviewAdaptationState>();
  return state || {
    urgencyMultiplier: 1.0,
    windowStart: new Date().toISOString(),
    windowFailures: 0,
    windowSuccesses: 0,
    lastUpdated: new Date().toISOString(),
  };
}

// Called after review outcome recorded (needs integration hook)
async updateReviewAdaptation(success: boolean): Promise<void> {
  const state = await this.getReviewAdaptation();
  
  if (success) {
    state.urgencyMultiplier = Math.max(0.5, state.urgencyMultiplier - 0.01);
    state.windowSuccesses++;
  } else {
    state.urgencyMultiplier = Math.min(2.0, state.urgencyMultiplier + 0.05);
    state.windowFailures++;
  }
  
  state.lastUpdated = new Date().toISOString();
  await this.putStrategyState(state);
}
```

### Required Work

- [ ] Add `getReviewAdaptation()` method to SRSNavigator
- [ ] Integrate `updateReviewAdaptation()` with card response recording flow
- [ ] Decide: Should multiplier affect backlog pressure or just base urgency?
- [ ] Consider reset behavior on long breaks (user returning after 6 months)
- [ ] Consider course-specific vs global multipliers
- [ ] Add provenance entry explaining multiplier contribution

### Open Questions

1. **Who calls `updateReviewAdaptation`?** — Needs hook into card response recording (currently in `UserDB.recordInteraction()` or similar)

2. **Rolling window reset?** — Should the window reset periodically to allow recovery from bad streaks?

3. **Visibility?** — Should users see their current multiplier? Could be motivating or discouraging.

4. **Initial calibration?** — New users start at 1.0. Should there be an initial calibration period with more aggressive updates?

### Priority

**Medium** — High value for learning outcomes, moderate implementation complexity. Requires integration with card response recording flow.

---

## Implementation Order

1. ✅ **Backlog Pressure** (implemented) — Fixes immediate balance issue
2. **Per-User Adaptation** — High value, moderate complexity
3. **Orchestrator Tuning** — Lower priority if backlog pressure works well

---

## Related Files

| File | Purpose |
|------|---------|
| `core/navigators/generators/srs.ts` | SRS urgency calculation, backlog pressure |
| `core/orchestration/index.ts` | Orchestration context, deviation logic |
| `core/types/contentNavigationStrategy.ts` | Strategy config, learnable weights |
| `core/types/strategyState.ts` | Per-user strategy state storage |
| `impl/couch/userDB.ts` | User interaction recording |