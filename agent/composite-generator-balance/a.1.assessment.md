# Assessment: CompositeGenerator Score Balance

**Date**: 2026-02-02  
**Status**: IMPLEMENTED (Option D)  
**Issue**: SRS review cards are completely excluded from study sessions due to score scale mismatch with ELO generator

## Problem Statement

The `CompositeGenerator` merges candidate cards from multiple generators (ELO for new cards, SRS for reviews) but raw scores are on incompatible scales, causing systematic exclusion of one generator's output.

### Observed Behavior

From production logs:

```
[Composite] Generator breakdown: ELO (default): 50 new (top: 1.00) | SRS (default): 47 reviews (top: 0.95)
```

Yet the final pipeline result:

```
generators: Array [ { name: "ELO (default)", cardCount: 50, ... } ]
Result: 20 cards selected (20 new, 0 reviews)
```

**47 due reviews exist but ZERO made it into the final selection.**

### Root Cause Analysis

| Generator | Score Formula | Output Range | Top Score Typical |
|-----------|--------------|--------------|-------------------|
| ELO | `max(0, 1 - distance/500)` | 0.0 - 1.0 | 0.996 - 1.000 |
| SRS | `min(0.95, 0.5 + urgency*0.45)` | 0.5 - 0.95 | 0.72 - 0.95 |

The CompositeGenerator:
1. Fetches `limit` cards from each generator (50 each)
2. Merges by cardId (cards in both get frequency boost)
3. Sorts by raw score descending
4. Returns top `limit` cards (50)

Since ELO's 50th-ranked card typically scores ~0.996 and SRS's top card scores ~0.95, **ALL 50 slots go to ELO cards**. SRS cards are eliminated before filters even run.

### Impact

1. **Review pile-up**: Scheduled reviews never execute, building indefinitely
2. **Learning degradation**: SRS magic requires timely reviews for long-term retention
3. **Algorithm failure**: The fundamental new/review balance is broken
4. **Silent failure**: No errors; system appears to work but learning outcomes suffer

---

## Design Constraints & Requirements

### Must Have

1. **No indefinite review pile-up** - Reviews must eventually execute
2. **No content starvation** - New content must still surface when reviews are caught up
3. **Graceful degradation** - Handle usage spikes and breaks without death spiral
4. **Backward compatibility** - Don't break courses with custom navigation strategies

### Should Have

1. **Transparency** - Provenance should explain why cards were selected
2. **Configurability** - Courses may want different new/review balance
3. **Equilibrium seeking** - System should naturally find healthy balance

### Nice to Have

1. **Learnable weights** - Orchestration layer could tune balance over time
2. **Per-user adaptation** - Different users may need different ratios

---

## Options Analysis

### Option A: Cap Inversion (Swap Score Ceilings)

**Change**: ELO max → 0.95, SRS max → 1.00

```typescript
// srs.ts - change line 185
const score = Math.min(1.0, 0.5 + urgency * 0.45);  // was 0.95

// elo.ts - change line 95
const score = Math.min(0.95, Math.max(0, 1 - distance / 500));  // add cap
```

**Pros**:
- Minimal code change (2 lines)
- High-urgency reviews unconditionally escape their hole
- Caught-up users still see new content (SRS scores < 0.95 when not urgent)

**Cons**:
- Hardcoded; doesn't adapt to course-specific needs
- Doesn't address the fundamental scale incompatibility
- Review urgency formula still compressed into narrow range

### Option B: Per-Generator Normalization in CompositeGenerator

**Change**: Normalize each generator's output to [0, 1] before merging

```typescript
// In CompositeGenerator, after fetching from generators:
function normalizeScores(cards: WeightedCard[]): WeightedCard[] {
  if (cards.length === 0) return cards;
  const min = Math.min(...cards.map(c => c.score));
  const max = Math.max(...cards.map(c => c.score));
  const range = max - min || 1;
  return cards.map(c => ({
    ...c,
    score: (c.score - min) / range
  }));
}
```

**Pros**:
- Each generator's top card has equal representation
- Generators become independent; can use any internal scale
- No changes to individual generators

**Cons**:
- Can distort semantics (a generator's "bad" card becomes 0.0)
- Single generator with uniform scores gets normalized oddly
- Doesn't encode any policy about new vs review priority

### Option C: Quota-Based Allocation (Reserve Slots)

**Change**: Reserve minimum slots per generator type

```typescript
interface CompositeConfig {
  minReviewSlots: number;  // e.g., 5
  minNewSlots: number;     // e.g., 5
  remainderPolicy: 'score' | 'roundRobin' | 'weighted';
}
```

**Pros**:
- Guarantees reviews always surface
- Guarantees new content always surfaces
- Explicit, configurable policy

**Cons**:
- Arbitrary numbers; what's the right ratio?
- Doesn't respond to actual urgency
- May force low-quality cards into session

### Option D: Eligibility-Based Backlog Model

**Change**: Reconceptualize SRS times as "eligibility dates" not "due dates"

Key insight from requirements: *reviewing a little later may be optimal*. We don't aim to beat review queues to zero (death spiral). Instead, maintain a healthy backlog of *eligible* reviews.

Implementation:
1. SRS urgency formula considers "time since eligible" not "overdue"
2. Reviews become eligible at scheduled time but don't gain urgency immediately
3. Urgency ramps up over time, eventually overriding new content
4. Add "review backlog size" as an input to scoring

```typescript
// New SRS urgency with backlog awareness:
const backlogSize = dueReviews.length;
const healthyBacklog = 20;  // Target: ~20 eligible reviews
const backlogPressure = Math.max(0, (backlogSize - healthyBacklog) / healthyBacklog);

// Urgency increases when backlog exceeds healthy threshold
const urgencyBoost = backlogPressure * 0.2;  // Up to +0.2 when backlog doubles
const score = Math.min(1.0, 0.5 + urgency * 0.45 + urgencyBoost);
```

**Pros**:
- Philosophically aligned with SRS research (spacing effect)
- Self-regulating; responds to actual backlog state
- Handles usage breaks gracefully (backlog builds, urgency rises)
- Handles usage spikes gracefully (backlog drains, new content appears)

**Cons**:
- More complex implementation
- "Healthy backlog" threshold is a new parameter
- Requires understanding across the team

### Option E: Hybrid Approach (A + D)

**Change**: Combine cap inversion with backlog-aware urgency

1. Swap caps (A) for immediate fix
2. Implement backlog pressure (D) for adaptive behavior
3. Add configuration for courses that want different behavior

```typescript
// srs.ts
const backlogPressure = computeBacklogPressure(dueReviews.length);
const baseUrgency = 0.5 + urgency * 0.45;
const score = Math.min(1.0, baseUrgency + backlogPressure);

// elo.ts
const score = Math.min(0.95, Math.max(0, 1 - distance / 500));
```

**Pros**:
- Immediate fix (cap inversion)
- Long-term adaptivity (backlog pressure)
- Maintains clear priority: very urgent reviews > new content > normal reviews

**Cons**:
- Two changes to understand/maintain
- More testing surface

---

## Evaluation Matrix

| Criterion | A: Caps | B: Normalize | C: Quotas | D: Backlog | E: Hybrid |
|-----------|---------|--------------|-----------|------------|-----------|
| Fixes immediate issue | ✓✓ | ✓✓ | ✓ | ✓ | ✓✓ |
| No review pile-up | ✓ | ✓ | ✓✓ | ✓✓ | ✓✓ |
| Graceful breaks/spikes | ✗ | ✗ | ✗ | ✓✓ | ✓✓ |
| Implementation simplicity | ✓✓ | ✓ | ✓ | ✗ | ✗ |
| Backward compatible | ✓✓ | ✓ | ✗ | ✓ | ✓ |
| Transparent/debuggable | ✓ | ✗ | ✓✓ | ✓ | ✓ |
| Future extensibility | ✗ | ✓ | ✓ | ✓✓ | ✓✓ |

---

## Known Unknowns / Questions

1. **What is a "healthy" review backlog size?**
   - Depends on session length, frequency, card difficulty
   - Could be configurable per-course
   - Could be learned from user behavior

2. **Should new cards ever completely override reviews?**
   - Current thinking: No, max urgency reviews should always surface
   - But what about "first day" users with zero reviews?

3. **How do we handle courses with only one generator type?**
   - ELO-only: Works fine, no reviews to balance
   - SRS-only: Would need separate new-card acquisition mechanism
   - Already handled by CompositeGenerator's existing logic

4. **Does the orchestration layer complicate this?**
   - Learnable weights could interact with cap changes
   - May need to mark these as `staticWeight: true`

5. **What's the right urgency curve?**
   - Linear? Exponential? Sigmoid?
   - Affects how aggressively backlog clears

---

## Recommendation

**Implement Option E (Hybrid Approach)** in two phases:

### Phase 1: Immediate Fix (Cap Inversion)

- Swap score caps: ELO max 0.95, SRS max 1.00
- 2-line change, immediately restores review surfacing
- Low risk, easily reversible

### Phase 2: Adaptive Behavior (Backlog Pressure)

- Add backlog-aware urgency boost to SRS
- Implement with configurable `healthyBacklog` threshold
- Default to 20, allow override in strategy config
- Add provenance entries explaining backlog pressure contribution

### Rationale

1. **Phase 1 is urgent** - Reviews are piling up in production now
2. **Phase 2 provides stability** - Handles real-world usage patterns
3. **Combined, they encode a clear priority hierarchy**:
   - Very urgent reviews (backlog > 2x healthy): score → 1.0
   - Moderately urgent reviews: score 0.75-0.95
   - New content matched to skill: score 0.90-0.95
   - Less urgent reviews: score 0.50-0.75
   - New content far from skill: score < 0.50

This hierarchy ensures:
- Users are never blocked from learning new content
- Reviews don't pile up indefinitely
- Breaks from study are handled gracefully (backlog builds urgency)
- Heavy study sessions drain backlog (new content reappears)

---

## Implementation Decision

**Implemented**: Option D (Backlog Pressure Model) only.

**Cap inversion (Option A) deemed unnecessary** because:
- With backlog pressure, SRS scores naturally rise to compete with ELO when backlog exceeds healthy threshold
- When backlog is healthy (≤20), ELO dominates (scores ~1.0) - this is correct behavior (prioritize new content when caught up)
- When backlog is high (40+), SRS gets +0.25 boost → scores 0.75-1.0, competing with ELO
- When backlog is very high (60+), SRS gets +0.50 boost → scores 0.95-1.0, matching/exceeding ELO

The backlog pressure mechanism provides **self-regulating priority ordering** without artificial caps.

### Changes Made

**File**: `packages/db/src/core/navigators/generators/srs.ts`

1. Added backlog pressure computation:
   - `computeBacklogPressure(dueCount)` returns 0-0.5 based on how much backlog exceeds healthy threshold
   - Linear ramp: 0 at healthy, 0.25 at 2x, 0.50 at 3x+

2. Removed 0.95 score cap - SRS can now score up to 1.0

3. Added `healthyBacklog` config option (default: 20) parseable from strategy `serializedData`

4. Enhanced logging to show backlog pressure status

5. Updated provenance reason strings to include backlog contribution

### Extension Work

See `a.2.extensions-assessment.md` for deferred nice-to-have extensions:
- Orchestrator-tuned generator weights
- Per-user review urgency adaptation (reviewUrgencyMultiplier)