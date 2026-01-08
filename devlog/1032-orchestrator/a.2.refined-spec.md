# Refined Spec: Evolutionary Orchestration

## Core Abstraction: Learnable Weights

Everything that can be tuned is a **learnable weight**:

```typescript
interface LearnableWeight {
  weight: number;       // Peak value, 1.0 = neutral, range [0, 2+]
  confidence: number;   // 0-1, controls exploration variance
  sampleSize: number;   // Observation count for update stability
}
```

This applies uniformly to:
- **Strategies** (filter multipliers, generator contribution)
- **Content** (card utility, tag utility)
- **Relationships** (prerequisite strength, interference severity)

---

## Weight Application: Bell Curve Sampling

Instead of binary cohort inclusion, every user samples from a distribution:

```typescript
function sampleEffectiveWeight(
  learnable: LearnableWeight,
  userCohortSeed: number  // Deterministic per-user hash
): number {
  // Variance inversely proportional to confidence
  // High confidence → narrow curve → effective ≈ peak
  // Low confidence → wide curve → more exploration
  const variance = (1 - learnable.confidence) * MAX_VARIANCE;

  // cohortOffset: normalized distance from center, can be negative
  // Derived from userCohortSeed, range [-1, 1] or similar
  const cohortOffset = hashToCohortOffset(userCohortSeed);

  // Bell curve centered at 0, scaled by offset
  const deviation = cohortOffset * Math.sqrt(variance);

  return clamp(learnable.weight + deviation, 0, MAX_WEIGHT);
}
```

**Key properties:**
- Deterministic: same user always gets same offset
- Continuous: no binary include/exclude
- Self-tuning: confidence controls exploration breadth
- Rotatable: changing the cohort seed redistributes sampling

---

## Strategy Weight Model

```typescript
interface ContentNavigationStrategyData {
  // ... existing fields ...

  learnable: LearnableWeight;  // Replaces static weight

  // Optional: override to disable learning (purely static weight)
  static?: boolean;
}
```

### Application in Pipeline

**For Filters (multipliers):**
```typescript
// Current: newScore = card.score * multiplier
// Refined:
const effectiveWeight = sampleEffectiveWeight(
  filter.learnable,
  context.userCohortSeed
);
const scaledMultiplier = 1 + (multiplier - 1) * effectiveWeight;
newScore = card.score * scaledMultiplier;
```

**For Generators (contribution weight):**
```typescript
// In CompositeGenerator:
const effectiveWeight = sampleEffectiveWeight(
  generator.learnable,
  context.userCohortSeed
);
weightedScore = generatorScore * effectiveWeight;
```

---

## Content Weight Model

Cards and tags can also carry learnable weights:

```typescript
interface CardMetadata {
  // ... existing fields ...

  utility?: LearnableWeight;  // Optional, defaults to {weight: 1, confidence: 0, sampleSize: 0}
}

interface TagMetadata {
  // ... existing fields ...

  utility?: LearnableWeight;
}
```

### Content Utility Filter

A built-in filter applies content-level utility as a multiplier:

```typescript
class ContentUtilityFilter implements CardFilter {
  name = 'ContentUtility';

  async transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]> {
    return cards.map(card => {
      const cardUtility = await this.getCardUtility(card.cardId);
      const effectiveWeight = sampleEffectiveWeight(
        cardUtility,
        context.userCohortSeed
      );

      return {
        ...card,
        score: card.score * effectiveWeight,
        provenance: [...card.provenance, {
          strategy: 'contentUtility',
          strategyName: 'Content Utility',
          strategyId: 'CONTENT_UTILITY_FILTER',
          action: effectiveWeight < 1 ? 'penalized' : effectiveWeight > 1 ? 'boosted' : 'passed',
          score: card.score * effectiveWeight,
          reason: `Card utility ${cardUtility.weight.toFixed(2)} (confidence: ${cardUtility.confidence.toFixed(2)})`
        }]
      };
    });
  }
}
```

---

## Outcome Tracking

### Session Outcome Document

```typescript
interface SessionOutcome {
  _id: `SESSION_OUTCOME-${string}`;
  docType: DocType.SESSION_OUTCOME;

  userId: string;
  courseId: string;
  sessionId: string;
  timestamp: string;

  // What was applied
  strategyExposures: Array<{
    strategyId: string;
    effectiveWeight: number;  // What the user actually experienced
  }>;

  cardExposures: Array<{
    cardId: string;
    effectiveUtility: number;
    outcome: 'correct' | 'incorrect' | 'skipped';
  }>;

  // Aggregate outcomes
  metrics: {
    cardsStudied: number;
    accuracy: number;
    eloGain: number;
    sessionDurationMs: number;
    completedSession: boolean;  // Did user finish or abandon?
  };
}
```

### Aggregated Weight Updates

Periodically (or after N sessions), update learnable weights:

```typescript
interface WeightUpdate {
  // Which weight to update
  targetType: 'strategy' | 'card' | 'tag';
  targetId: string;

  // Observations
  observations: Array<{
    effectiveWeight: number;
    outcomeScore: number;  // Normalized 0-1
  }>;
}

function updateLearnableWeight(
  current: LearnableWeight,
  observations: WeightUpdate['observations']
): LearnableWeight {
  // Bayesian update or weighted moving average
  // High-outcome observations near weight X → increase confidence, move weight toward X
  // Conflicting observations → decrease confidence

  const newSampleSize = current.sampleSize + observations.length;

  // Compute weighted average of successful weights
  const successWeightedSum = observations.reduce(
    (sum, obs) => sum + obs.effectiveWeight * obs.outcomeScore,
    current.weight * current.sampleSize
  );
  const totalWeight = current.sampleSize + observations.reduce(
    (sum, obs) => sum + obs.outcomeScore,
    0
  );

  const newWeight = successWeightedSum / totalWeight;

  // Confidence increases with sample size, decreases with variance
  const newConfidence = computeConfidence(newSampleSize, observations);

  return {
    weight: newWeight,
    confidence: newConfidence,
    sampleSize: newSampleSize,
  };
}
```

---

## Cohort Seed Management

```typescript
interface CohortSeedConfig {
  // Global seed, rotated periodically
  currentSeed: string;

  // Rotation schedule
  rotationIntervalDays: number;
  lastRotatedAt: string;

  // Per-strategy overrides (optional)
  strategySeeds?: Record<string, string>;
}
```

Rotation ensures:
- No user is permanently stuck with extreme weight samples
- Observations span the weight space over time
- Deterministic within rotation period

---

## What This Enables

### Continuous Exploration
- Every strategy/card is always being explored at varying intensities
- No need for explicit A/B test setup
- System naturally finds optimal weights

### Content Evolution
- Cards that consistently lead to good outcomes get higher utility
- Cards that cause abandonment/failure get lower utility
- System surfaces "barrier" content automatically

### Self-Healing Curriculum
- Low-utility content is de-prioritized (soft exclusion)
- Authors see which content needs improvement
- High-utility content rises to prominence

### Growing a Curriculum
- New content starts with neutral weight, low confidence
- System aggressively explores its utility
- Effective content is retained; ineffective fades
- Analogous to gradient descent in parameter space

---

## Simplifications vs. Original Assessment

| Original (Option B) | Refined |
|---------------------|---------|
| Binary cohort include/exclude | Continuous weight sampling |
| Separate `StrategyVariant` doc type | `LearnableWeight` embedded in existing docs |
| Complex cohort threshold logic | Simple bell curve math |
| Strategies only | Strategies + Content uniformly |
| Manual confidence setting | Automatic Bayesian updates |

The refined model is:
- **More expressive** (continuous vs. binary)
- **Simpler to implement** (no threshold logic, unified abstraction)
- **More general** (applies to content, not just strategies)

---

## Open Questions

### 1. Update Frequency
- Real-time (after each session)?
- Batched (daily aggregation)?
- Recommendation: Start with daily batched updates for simplicity

### 2. Cold Start
- New strategies/content: what initial weight and confidence?
- Recommendation: weight=1.0, confidence=0.1 (aggressive exploration)

### 3. Weight Bounds
- Should weights be unbounded or clamped?
- Recommendation: Clamp to [0.1, 3.0] to prevent extreme behaviors

### 4. Negative Outcomes
- How to handle content that correlates with abandonment?
- Recommendation: Track "non-outcomes" (sessions without this content) as baseline

### 5. Attribution
- Multiple strategies active → how to attribute outcomes?
- Recommendation: Proportional attribution based on score contribution
