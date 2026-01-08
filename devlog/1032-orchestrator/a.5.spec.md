# Specification: Evolutionary Orchestration

*Draft v3 - Deviation-based gradient learning, simplified*

---

## Overview

An orchestration layer that enables navigation strategies to compete, learns which strategies produce better outcomes via gradient estimation, and distributes exploration across users via deviation-based cohort sampling.

### Goals

1. **Strategy weighting**: Strategies contribute with learnable weights
2. **Deviation-based exploration**: Users distributed across weight space via stable deviations
3. **Gradient learning**: Discover optimal weights by correlating deviation with outcomes
4. **Signal injection**: Accept optimization target from above

### Non-Goals (Deferred)

- Encompassing relationships and credit flow (see `agent/encompassing/` if required)
- Cross-course strategy sharing
- Author reward mechanisms
- Complex dashboards beyond basic observability

---

## Core Mechanism

### Deviation-Based Weight Distribution

Each user has a **stable deviation** from the peak weight, determined by hash:

```typescript
effectiveWeight(user, strategy) = peakWeight + deviation * spread

where:
  deviation = hash(userId, strategyId, salt) → [-1, 1]  // stable per user
  spread = max(MIN_SPREAD, (1 - confidence) * MAX_SPREAD)
```

**Key insight**: Deviation is constant for a user. As the peak weight updates, all users' effective weights shift together. This decouples weight updates from observation validity. As confidence grows and spread shrinks, all users are pulled toward the optimal peak.

### Gradient Interpretation

Regression on **deviation vs outcome** (not absolute weight vs outcome):

- **Positive correlation** (+deviation → better outcome): increase peak
- **Negative correlation** (+deviation → worse outcome): decrease peak
- **Flat gradient**: at optimal, no change needed

### Lifecycle

```
New strategy:    Low confidence → wide spread → noisy gradient → big adjustments
Learning:        Gradient visible → peak drifts → confidence grows → spread shrinks
Converged:       High confidence → minimum spread → flat gradient → stable
Disturbed:       Gradient reappears → peak drifts → adapts to new optimal
```

---

## Data Model

### LearnableWeight

Core structure for weights that can be learned:

```typescript
interface LearnableWeight {
  weight: number;       // Current peak, 1.0 = neutral, range [0.1, 3.0]
  confidence: number;   // 0-1, controls spread width
  sampleSize: number;   // Total observations

  // Optional: for visualization/debugging
  history?: Array<{
    timestamp: string;
    weight: number;
    confidence: number;
    gradient: number;
  }>;
}

const DEFAULT_LEARNABLE_WEIGHT: LearnableWeight = {
  weight: 1.0,
  confidence: 0.1,  // Low confidence = wide spread = aggressive exploration
  sampleSize: 0,
};
```

### Strategy Weight Extension

Extend `ContentNavigationStrategyData` with optional learnable weight:

```typescript
interface ContentNavigationStrategyData {
  // ... existing fields ...

  /**
   * Learnable weight for this strategy.
   * If omitted, defaults to { weight: 1.0, confidence: 0.5, sampleSize: 0 }
   */
  learnable?: LearnableWeight;

  /**
   * If true, weight is static and not subject to learning.
   * Useful for foundational strategies that shouldn't be tuned.
   */
  staticWeight?: boolean;
}
```

### CohortConfig

Course-level configuration for deviation computation:

```typescript
interface CohortConfig {
  /**
   * Salt for deviation computation.
   * Combined with user ID and strategy ID to compute deviation.
   * Set once at course creation; no rotation needed.
   * (Lock-in is not a concern: as confidence grows, spread shrinks,
   * pulling all users toward optimal regardless of their deviation.)
   */
  salt: string;
}
```

### UserOutcomeRecord

Aggregate outcome per user per period (strategy-independent):

```typescript
interface UserOutcomeRecord {
  _id: `USER_OUTCOME-${string}`;
  docType: DocType.USER_OUTCOME;

  userId: string;
  courseId: string;

  // Outcome over measurement window (result of ALL strategies combined)
  outcomeValue: number;  // Injected signal (e.g., ELO gain, accuracy in zone)

  // Period bounds
  periodStart: string;  // ISO timestamp
  periodEnd: string;
}
```

**Note**: This record is strategy-independent. The user's outcome is the combined result of all active strategies. When computing gradients for a specific strategy, we:
1. Fetch UserOutcomeRecords for the period
2. Compute each user's deviation for that strategy (from hash)
3. Regress deviation vs outcome

**Storage**:
- Computed locally, stored in userDB
- Server periodically aggregates across users for gradient computation

### StrategyLearningState

Observability document for strategy learning (separate from strategy doc):

```typescript
interface StrategyLearningState {
  _id: `STRATEGY_LEARNING-${string}`;
  docType: DocType.STRATEGY_LEARNING;

  strategyId: string;
  courseId: string;

  // Computed regression (from recent observations)
  regression: {
    gradient: number;      // Slope: deviation → outcome
    intercept: number;     // For visualization
    rSquared: number;      // Fit quality
    observationCount: number;
  };

  // When last updated
  lastUpdatedAt: string;
}
```

**Note**: The `LearnableWeight` lives on the strategy document itself (for simplicity and co-location). `StrategyLearningState` is a separate document for observability—storing regression stats, enabling visualization, without cluttering the strategy doc.

---

## Deviation Computation

### Computing User Deviation

Deterministic, stable per user × strategy × salt:

```typescript
const MIN_SPREAD = 0.1;   // Never narrower than this
const MAX_SPREAD = 0.5;   // Maximum spread at zero confidence

function computeDeviation(
  userId: string,
  strategyId: string,
  salt: string
): number {
  // Hash to get deterministic pseudo-random value
  const hash = fnv1a(`${userId}:${strategyId}:${salt}`);

  // Map to [-1, 1]
  return (hash / 0xffffffff) * 2 - 1;
}

function computeSpread(confidence: number): number {
  const rawSpread = (1 - confidence) * MAX_SPREAD;
  return Math.max(rawSpread, MIN_SPREAD);
}

function computeEffectiveWeight(
  learnable: LearnableWeight,
  userId: string,
  strategyId: string,
  salt: string
): number {
  const deviation = computeDeviation(userId, strategyId, salt);
  const spread = computeSpread(learnable.confidence);

  const effectiveWeight = learnable.weight + deviation * spread;
  return clamp(effectiveWeight, 0.1, 3.0);
}
```

### Properties

- **Deterministic**: Same user + strategy + salt = same deviation
- **Independent per strategy**: Different strategies have independent deviations
- **Stable**: Deviation is constant for a user (salt doesn't rotate)
- **Minimum spread**: Always have exploration capacity, even at high confidence
- **Convergence**: As confidence grows, spread shrinks, pulling all users toward optimal peak

### Spread Visualization

```
Confidence = 0.1 (low, aggressive exploration):
  spread = 0.45

     │
     │    ╭───────────────╮
     │   ╱                 ╲
     │  ╱                   ╲
     │ ╱                     ╲
     │╱                       ╲
     ┼───────────┬───────────┬───
   0.55        1.0         1.45   weight
              peak


Confidence = 0.9 (high, mostly converged):
  spread = max(0.05, 0.1) = 0.1

     │
     │          ╭╮
     │         ╱  ╲
     │        ╱    ╲
     │       ╱      ╲
     │______╱        ╲______
     ┼───────────┬───────────┬───
    0.9         1.0         1.1   weight
              peak
```

---

## Weight Application

### In Filters

Filters that produce multipliers apply weight to scale the effect:

```typescript
class WeightedFilter implements CardFilter {
  constructor(
    private baseFilter: CardFilter,
    private strategyData: ContentNavigationStrategyData
  ) {}

  async transform(
    cards: WeightedCard[],
    context: FilterContext
  ): Promise<WeightedCard[]> {
    const effectiveWeight = context.getEffectiveWeight(this.strategyData);

    const filtered = await this.baseFilter.transform(cards, context);

    return filtered.map(card => {
      // Scale the filter's effect by weight
      const originalScore = this.getOriginalScore(card, cards);
      const filterEffect = card.score - originalScore;
      const scaledEffect = filterEffect * effectiveWeight;

      return {
        ...card,
        score: originalScore + scaledEffect,
        provenance: [...card.provenance, {
          strategy: this.strategyData.type,
          strategyName: this.strategyData.displayName,
          strategyId: this.strategyData._id,
          effectiveWeight,
          deviation: context.getDeviation(this.strategyData),
        }],
      };
    });
  }
}
```

### In Generators

Generators in a CompositeGenerator have their contributions weighted:

```typescript
class WeightedCompositeGenerator implements CardGenerator {
  async generateCards(context: GeneratorContext): Promise<WeightedCard[]> {
    const allCards: WeightedCard[] = [];

    for (const generator of this.generators) {
      const effectiveWeight = context.getEffectiveWeight(generator.strategyData);
      const cards = await generator.generateCards(context);

      for (const card of cards) {
        allCards.push({
          ...card,
          score: card.score * effectiveWeight,
          provenance: [...card.provenance, {
            strategy: generator.strategyData.type,
            strategyId: generator.strategyData._id,
            effectiveWeight,
            deviation: context.getDeviation(generator.strategyData),
          }],
        });
      }
    }

    return this.deduplicate(allCards);
  }
}
```

---

## Outcome Recording

### When to Record

Outcomes are recorded locally (client-side) at period boundaries. The server aggregates across users for gradient computation.

**Client-side (per user):**

```typescript
async function recordUserOutcome(
  userId: string,
  courseId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<void> {
  const outcomeValue = await computeOutcomeSignal(userId, courseId, periodStart, periodEnd);

  const record: UserOutcomeRecord = {
    _id: `USER_OUTCOME-${generateId()}`,
    docType: DocType.USER_OUTCOME,
    userId,
    courseId,
    outcomeValue,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };

  await userDB.put(record);
}
```

**Server-side (aggregation):**

```typescript
async function aggregateOutcomesForGradient(
  strategyId: string,
  courseId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<Array<{ deviation: number; outcomeValue: number }>> {
  const cohortConfig = await getCohortConfig(courseId);
  const userOutcomes = await getAllUserOutcomes(courseId, periodStart, periodEnd);

  return userOutcomes.map(record => ({
    deviation: computeDeviation(record.userId, strategyId, cohortConfig.salt),
    outcomeValue: record.outcomeValue,
  }));
}
```

### Signal Computation

Placeholder signal: accuracy in zone of desirable difficulty, or ELO gain.

```typescript
async function computeOutcomeSignal(
  userId: string,
  courseId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  // Get user's activity in this period
  const sessions = await getUserSessions(userId, courseId, periodStart, periodEnd);

  if (sessions.length === 0) return 0;

  // Option A: Accuracy in zone
  const accuracy = computeAccuracy(sessions);
  const zoneScore = scoreAccuracyInZone(accuracy, { min: 0.7, max: 0.95 });

  // Option B: ELO gain
  const eloGain = await computeEloGain(userId, courseId, periodStart, periodEnd);

  // For now, use zone score. Signal type can be configurable.
  return zoneScore;
}

function scoreAccuracyInZone(accuracy: number, zone: { min: number; max: number }): number {
  const center = (zone.min + zone.max) / 2;

  if (accuracy >= zone.min && accuracy <= zone.max) {
    // In zone: high score, peaks at center
    return 1 - Math.abs(accuracy - center) / (zone.max - zone.min);
  } else if (accuracy < zone.min) {
    // Too hard
    return accuracy / zone.min * 0.5;
  } else {
    // Too easy
    return (1 - (accuracy - zone.max) / (1 - zone.max)) * 0.5;
  }
}
```

---

## Weight Learning

### Gradient Computation

At the end of each period (or on-demand), compute gradient from recent observations:

```typescript
async function computeStrategyGradient(
  strategyId: string,
  courseId: string,
  lookbackPeriods: number = 4  // Use last N periods
): Promise<{ gradient: number; intercept: number; rSquared: number; n: number }> {
  const observations = await getRecentOutcomes(strategyId, courseId, lookbackPeriods);

  if (observations.length < 5) {
    return { gradient: 0, intercept: 0, rSquared: 0, n: observations.length };
  }

  // Simple linear regression: outcome = gradient * deviation + intercept
  const n = observations.length;
  const sumX = observations.reduce((s, o) => s + o.deviation, 0);
  const sumY = observations.reduce((s, o) => s + o.outcomeValue, 0);
  const sumXY = observations.reduce((s, o) => s + o.deviation * o.outcomeValue, 0);
  const sumX2 = observations.reduce((s, o) => s + o.deviation * o.deviation, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 0.0001) {
    return { gradient: 0, intercept: sumY / n, rSquared: 0, n };
  }

  const gradient = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - gradient * sumX) / n;

  // R-squared
  const meanY = sumY / n;
  const ssTotal = observations.reduce((s, o) => s + (o.outcomeValue - meanY) ** 2, 0);
  const ssResidual = observations.reduce((s, o) => {
    const predicted = gradient * o.deviation + intercept;
    return s + (o.outcomeValue - predicted) ** 2;
  }, 0);
  const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

  return { gradient, intercept, rSquared, n };
}
```

### Weight Update

Adjust peak weight based on gradient:

```typescript
async function updateStrategyWeight(
  strategyId: string,
  courseId: string
): Promise<void> {
  const strategy = await getStrategy(strategyId);
  if (strategy.staticWeight) return;

  const current = strategy.learnable ?? DEFAULT_LEARNABLE_WEIGHT;
  const { gradient, rSquared, n } = await computeStrategyGradient(strategyId, courseId);

  // Gradient tells us direction to move
  // Scale adjustment by confidence (less confident = bigger jumps)
  const learningRate = 0.1 * (1 - current.confidence);
  const adjustment = gradient * learningRate;

  const newWeight = clamp(current.weight + adjustment, 0.1, 3.0);

  // Update confidence based on sample size and gradient consistency
  const sizeFactor = 1 - 1 / (1 + (current.sampleSize + n) * 0.02);
  const consistencyFactor = Math.abs(gradient) < 0.1 ? 0.9 : 0.7;  // Flat gradient = more confident
  const newConfidence = clamp(sizeFactor * consistencyFactor, 0.1, 0.95);

  const updated: LearnableWeight = {
    weight: newWeight,
    confidence: newConfidence,
    sampleSize: current.sampleSize + n,
    history: [
      ...(current.history ?? []).slice(-50),  // Keep last 50 entries
      {
        timestamp: new Date().toISOString(),
        weight: newWeight,
        confidence: newConfidence,
        gradient,
      },
    ],
  };

  await updateStrategy(strategyId, { learnable: updated });

  // Also update learning state for visualization
  await updateLearningState(strategyId, courseId, { gradient, rSquared, n });
}
```

### Update Trigger

Server runs weight updates periodically (e.g., weekly):

```typescript
async function runPeriodUpdate(courseId: string): Promise<void> {
  const now = new Date();
  const periodEnd = now;
  const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);  // 1 week

  // Update weights for all strategies based on aggregated user outcomes
  const strategies = await getStrategies(courseId);
  for (const strategy of strategies) {
    if (!strategy.staticWeight) {
      await updateStrategyWeight(strategy._id, courseId);
    }
  }
}
```

**Note**: No salt rotation needed. The deviation-based model naturally pulls all users toward optimal as confidence grows and spread shrinks.

---

## Context Extension

Extend generator/filter context to provide deviation-aware weight lookup:

```typescript
interface OrchestrationContext {
  userId: string;
  courseId: string;
  salt: string;

  getDeviation(strategy: ContentNavigationStrategyData): number;
  getEffectiveWeight(strategy: ContentNavigationStrategyData): number;
}

function createOrchestrationContext(
  userId: string,
  courseId: string,
  salt: string
): OrchestrationContext {
  return {
    userId,
    courseId,
    salt,

    getDeviation(strategy: ContentNavigationStrategyData): number {
      return computeDeviation(userId, strategy._id, salt);
    },

    getEffectiveWeight(strategy: ContentNavigationStrategyData): number {
      if (strategy.staticWeight) {
        return strategy.learnable?.weight ?? 1.0;
      }

      const learnable = strategy.learnable ?? DEFAULT_LEARNABLE_WEIGHT;
      return computeEffectiveWeight(learnable, userId, strategy._id, salt);
    },
  };
}
```

---

## Provenance Extension

Extend provenance to include deviation:

```typescript
interface ProvenanceRecord {
  // ... existing fields ...

  /**
   * The effective weight applied for this user.
   */
  effectiveWeight?: number;

  /**
   * User's deviation from peak for this strategy.
   * Useful for debugging and analysis.
   */
  deviation?: number;
}
```

---

## Visualization

For sanity checking and debugging:

1. **Scatter plot**: deviation (x) vs outcomeValue (y)
   - Each point = one user's outcome for one period
   - Regression line overlaid
   - Slope = gradient (should be near zero when converged)

2. **Weight trajectory**: weight and confidence over time
   - Shows how the strategy has learned
   - Confidence growth indicates convergence

3. **Spread visualization**: current bell curve for the strategy
   - Shows exploration vs exploitation balance

---

## Incremental Implementation Path

### Phase 1: Static Weights

- Add `learnable` field to strategy data model
- Implement weight application in Pipeline
- No learning, no cohort variation
- **Value**: Authors can manually tune strategy influence

### Phase 2: Deviation Distribution

- Add salt to course config
- Implement `computeDeviation` and `computeEffectiveWeight`
- Different users experience different weights
- **Value**: Automatic exploration of weight space

### Phase 3: Outcome Recording

- Add `UserOutcomeRecord` doc type
- Implement period-based outcome aggregation
- Implement placeholder signal (accuracy in zone)
- **Value**: Data collection for learning

### Phase 4: Gradient Learning

- Implement `computeStrategyGradient` (linear regression)
- Implement `updateStrategyWeight` (adjust peak and confidence)
- Wire up period-end update job
- **Value**: System self-improves

### Phase 5: Observability

- Weight/confidence history
- Gradient visualization
- Basic admin view
- **Value**: Authors can see what's working

---

## Configuration

### Course-Level Config

```typescript
interface CourseOrchestrationConfig {
  enabled: boolean;

  // Signal function for measuring outcomes
  // For testing/dev, can inject a noop
  signalType: 'accuracy_in_zone' | 'elo_gain' | 'custom';
  customSignalFn?: string;  // Reference to registered function

  // Salt for deviation computation (set once at course creation)
  salt: string;

  learning: {
    periodDays: number;           // Default: 7
    lookbackPeriods: number;      // How many periods for gradient. Default: 4
    minObservations: number;      // Before computing gradient. Default: 5
  };

  bounds: {
    minSpread: number;            // Default: 0.1
    maxSpread: number;            // Default: 0.5
    minWeight: number;            // Default: 0.1
    maxWeight: number;            // Default: 3.0
  };
}
```

---

## Open Items for Implementation

1. **fnv1a implementation**: Need fast hash function for deviation computation

2. **Period job scheduling**: Express backend periodically updates weights based on aggregated user outcome docs

3. **Storage architecture**:
   - UserOutcomeRecord: Computed locally, stored in userDB
   - Server aggregates across users for gradient computation
   - Strategy docs (with LearnableWeight): Course DB
   - StrategyLearningState (observability): Course DB

4. **Signal abstraction**: Part of CourseOrchestrationConfig. For testing/dev, inject a noop.

5. **Provenance format**: Ensure deviation fits existing structure

---

*Draft v3 - Deviation-based gradient learning, simplified*
