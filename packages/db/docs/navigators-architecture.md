# Navigation Strategy Architecture

## Overview

The navigation strategy system selects and scores cards for study sessions. It uses a
**Pipeline architecture** where generators produce candidates and filters transform scores.

An **Evolutionary Orchestration** layer enables strategies to carry learnable weights that
automatically tune toward optimal values based on observed learning outcomes.

## Core Concepts

### WeightedCard

A card with a suitability score, audit trail, and pre-fetched metadata:

```typescript
interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;              // 0-1 suitability score
  provenance: StrategyContribution[];  // Audit trail
  tags?: string[];            // Pre-fetched tags (hydrated by Pipeline)
}

interface StrategyContribution {
  strategy: string;           // Type: 'elo', 'srs', 'hierarchyDefinition'
  strategyName: string;       // Human-readable: "ELO (default)"
  strategyId: string;         // Document ID: 'NAVIGATION_STRATEGY-ELO-default'
  action: 'generated' | 'passed' | 'boosted' | 'penalized';
  score: number;              // Score after this strategy
  reason: string;             // Human-readable explanation
  deviation?: number;         // User's deviation from peak weight (evolutionary)
}
```

### CardGenerator

Produces candidate cards with initial scores:

```typescript
interface CardGenerator {
  name: string;
  getWeightedCards(limit: number, context: GeneratorContext): Promise<WeightedCard[]>;
}
```

**Implementations:**
- `ELONavigator` — New cards scored by ELO proximity to user skill (scores 0.0-1.0)
- `SRSNavigator` — Review cards scored by overdueness, interval recency, and **backlog pressure** (scores 0.5-1.0)
- `HardcodedOrderNavigator` — Fixed sequence defined by course author
- `CompositeGenerator` — Merges multiple generators with frequency boost

#### SRS Backlog Pressure

The SRS generator implements a self-regulating **backlog pressure** mechanism that prevents review pile-up while maintaining healthy new/review balance:

- **Healthy backlog** (≤20 due reviews): No pressure boost, scores 0.5-0.95. New content (ELO) naturally dominates.
- **Elevated backlog** (40 due): +0.25 boost, scores 0.75-1.0. Reviews compete with new cards.
- **High backlog** (60+ due): +0.50 boost (max), scores 0.95-1.0. Reviews take priority.

This treats SRS scheduling times as **eligibility dates** rather than hard due dates—reviewing slightly later may be optimal. The system maintains a healthy backlog rather than always clearing to zero (avoiding "Anki death spiral").

Configuration via strategy `serializedData`:
```json
{ "healthyBacklog": 20 }
```

See `todo-review-adaptation.md` for planned per-user adaptation extensions.

### CardFilter

Transforms card scores (pure function, no side effects):

```typescript
interface CardFilter {
  name: string;
  transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]>;
}
```

Filters receive cards with pre-hydrated data (e.g., `card.tags`) from Pipeline, eliminating
redundant database queries.

**Implementations:**
- `HierarchyDefinitionNavigator` — Gates cards by prerequisite mastery (score=0 if locked)
- `InterferenceMitigatorNavigator` — Reduces scores for confusable content
- `RelativePriorityNavigator` — Boosts scores for high-utility content
- `UserTagPreferenceFilter` — Applies user-configured tag preferences (path constraints)
- `createEloDistanceFilter()` — Penalizes cards far from user's current ELO

### Pipeline

Orchestrates generator, data hydration, and filters:

```typescript
class Pipeline {
  constructor(
    generator: CardGenerator,
    filters: CardFilter[],
    user: UserDBInterface,
    course: CourseDBInterface
  )

  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // Build shared context (user ELO, orchestration context, etc.)
    const context = await this.buildContext();

    // Generate candidates
    let cards = await this.generator.getWeightedCards(fetchLimit, context);

    // Hydrate shared data (tags, etc.) in single batch query
    cards = await this.hydrateTags(cards);

    // Apply filters sequentially
    for (const filter of this.filters) {
      cards = await filter.transform(cards, context);
    }

    return cards.filter(c => c.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
  }
}
```

**Responsibilities:**
- **Context building** — Fetches shared data (user ELO, orchestration context) once for all strategies
- **Data hydration** — Pre-fetches commonly needed data (tags) in batch queries
- **Filter orchestration** — Applies filters in sequence, accumulating provenance
- **Result selection** — Removes zero-scores, sorts, and returns top N

## Pipeline Assembly

`PipelineAssembler` builds pipelines from strategy documents:

```typescript
const assembler = new PipelineAssembler();
const { pipeline, warnings } = await assembler.assemble({
  strategies: allStrategies,
  user,
  course,
});
```

Assembly logic:
1. Separate strategies into generators and filters by `NavigatorRole`
2. Instantiate generators — wrap multiple in `CompositeGenerator`
3. Instantiate filters — sorted alphabetically for determinism
4. Return `Pipeline(generator, filters)`

If no strategies are configured, `courseDB.createNavigator()` returns a default pipeline:
```typescript
Pipeline(
  CompositeGenerator([ELONavigator, SRSNavigator]),
  [eloDistanceFilter]
)
```

## Score Semantics

| Score | Meaning |
|-------|---------|
| 1.0 | Fully suitable |
| 0.5 | Neutral |
| 0.0 | Exclude (hard filter) |
| 0.x | Proportional suitability |

**All filters are multipliers.** This means:
- Filter order doesn't affect final scores (multiplication is commutative)
- Score 0 from any filter excludes the card
- Filters are applied alphabetically for determinism

## Provenance Tracking

Each card's provenance shows how it was scored:

```typescript
provenance: [
  {
    strategy: 'elo',
    strategyName: 'ELO (default)',
    strategyId: 'NAVIGATION_STRATEGY-ELO-default',
    action: 'generated',
    score: 0.85,
    reason: 'ELO distance 75 (card: 1025, user: 1100), new card'
  },
  {
    strategy: 'hierarchyDefinition',
    strategyName: 'Hierarchy: Phonics Basics',
    strategyId: 'NAVIGATION_STRATEGY-hierarchy-phonics',
    action: 'passed',
    score: 0.85,
    reason: 'Prerequisites met, tags: letter-sounds',
    deviation: 0.23  // User's position on bell curve for this strategy
  },
  {
    strategy: 'eloDistance',
    strategyName: 'ELO Distance Filter',
    strategyId: 'ELO_DISTANCE_FILTER',
    action: 'penalized',
    score: 0.72,
    reason: 'ELO distance 150 (card: 1150, user: 1000) → 0.85x'
  }
]
```

Use `getCardOrigin(card)` to extract 'new', 'review', or 'failed' from provenance.

---

## Evolutionary Orchestration

The orchestration layer enables strategies to **learn optimal weights** from observed
learning outcomes. Instead of fixed configuration, strategies carry **learnable weights**
that automatically tune toward effectiveness.

### LearnableWeight

Every strategy can carry a learnable weight:

```typescript
interface LearnableWeight {
  weight: number;       // Peak value, 1.0 = neutral, range [0.1, 3.0]
  confidence: number;   // 0-1, controls exploration width
  sampleSize: number;   // Total observations for this strategy

  history?: Array<{     // Optional: for visualization
    timestamp: string;
    weight: number;
    confidence: number;
    gradient: number;
  }>;
}
```

Strategies extend with:

```typescript
interface ContentNavigationStrategyData {
  // ... existing fields ...
  learnable?: LearnableWeight;   // Omitted = default weight 1.0
  staticWeight?: boolean;        // If true, not subject to learning
}
```

### Deviation-Based Weight Distribution

Each user experiences a **stable deviation** from the peak weight:

```
effectiveWeight(user, strategy) = peakWeight + deviation * spread

where:
  deviation = hash(userId, strategyId, salt) → [-1, 1]  // stable per user
  spread = max(MIN_SPREAD, (1 - confidence) * MAX_SPREAD)
```

**Key insight:** Deviation is constant for a user. As confidence grows and spread
shrinks, all users are pulled toward the optimal peak.

```typescript
// Example: Low confidence = wide exploration
{ weight: 1.0, confidence: 0.2 }
→ spread = 0.8 * MAX_SPREAD
→ users range from weight 0.6 to 1.4

// Example: High confidence = narrow convergence
{ weight: 1.2, confidence: 0.9 }
→ spread = 0.1 * MAX_SPREAD
→ users cluster around weight 1.15 to 1.25
```

### Outcome Recording

At the end of each learning period, user outcomes are recorded:

```typescript
interface UserOutcomeRecord {
  _id: `USER_OUTCOME::${courseId}::${periodId}`;
  docType: DocType.USER_OUTCOME;
  userId: string;
  courseId: string;
  periodStart: string;
  periodEnd: string;
  strategyExposures: Array<{
    strategyId: string;
    deviation: number;      // User's stable deviation for this strategy
  }>;
  outcomeValue: number;     // 0-1 learning outcome signal
}
```

The outcome signal combines multiple factors:
- Accuracy within target zone (not too easy, not too hard)
- ELO progression
- Session completion

### Gradient Learning

The system discovers optimal weights by correlating **deviation with outcomes**
across users:

```
+deviation → +outcome = positive gradient → increase peak weight
+deviation → -outcome = negative gradient → decrease peak weight
flat gradient = at optimum, increase confidence
```

Linear regression on (deviation, outcome) pairs produces:
- **Gradient**: Direction to adjust peak
- **R²**: Signal quality (high = consistent effect)
- **Sample size**: Update confidence

### Weight Update Cycle

Periodically (or on-demand), the system updates strategy weights:

```typescript
async function runPeriodUpdate(courseId: string): Promise<void> {
  for (const strategy of await getLearnableStrategies(courseId)) {
    const observations = await aggregateOutcomesForGradient(strategy);
    const { gradient, rSquared } = computeStrategyGradient(observations);
    await updateStrategyWeight(strategy, gradient, rSquared);
  }
}
```

**Update rules:**
- Positive gradient → increase peak weight
- Negative gradient → decrease peak weight
- Consistent observations → increase confidence
- Noisy observations → decrease confidence

### Observability

The orchestration layer exposes API endpoints for monitoring:

| Endpoint | Purpose |
|----------|---------|
| `GET /orchestration/:courseId/state` | All learning states |
| `GET /orchestration/:courseId/weights` | Current weights summary |
| `GET /orchestration/:courseId/strategy/:id/history` | Weight trajectory over time |
| `GET /orchestration/:courseId/strategy/:id/scatter` | Deviation vs outcome data |
| `GET /orchestration/:courseId/strategy/:id/distribution` | Bell curve visualization |
| `POST /orchestration/:courseId/update` | Trigger period update |

An admin dashboard in platform-ui visualizes strategy weights, confidence,
gradient direction, and historical trajectories.

### Lifecycle

```
New strategy:    Low confidence → wide spread → noisy gradient → big adjustments
Learning:        Gradient visible → peak drifts → confidence grows → spread shrinks
Converged:       High confidence → minimum spread → flat gradient → stable
Disturbed:       Gradient reappears → peak drifts → adapts to new optimal
```

### Static vs Learnable

Set `staticWeight: true` for foundational strategies that should not be tuned:

```typescript
{
  strategyType: 'hierarchyDefinition',
  name: 'Core Prerequisites',
  staticWeight: true,  // Never tuned by orchestration
  // learnable field ignored
}
```

---

## Creating New Strategies

### Generator

```typescript
class MyGenerator extends ContentNavigator implements CardGenerator {
  name = 'My Generator';

  async getWeightedCards(limit: number, context?: GeneratorContext): Promise<WeightedCard[]> {
    const candidates = await this.findCandidates(limit);
    
    return candidates.map(c => ({
      cardId: c.id,
      courseId: this.course.getCourseID(),
      score: this.computeScore(c),
      provenance: [{
        strategy: 'myGenerator',
        strategyName: this.name,
        strategyId: this.strategyId || 'MY_GENERATOR',
        action: 'generated',
        score: this.computeScore(c),
        reason: 'Explanation here, new card'
      }]
    }));
  }
}
```

Register in `NavigatorRoles` as `NavigatorRole.GENERATOR`.

### Filter

```typescript
class MyFilter extends ContentNavigator implements CardFilter {
  name = 'My Filter';

  async transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]> {
    return cards.map(card => {
      const multiplier = this.computeMultiplier(card, context);
      const newScore = card.score * multiplier;
      const action = multiplier < 1 ? 'penalized' : multiplier > 1 ? 'boosted' : 'passed';
      
      return {
        ...card,
        score: newScore,
        provenance: [...card.provenance, {
          strategy: 'myFilter',
          strategyName: this.name,
          strategyId: this.strategyId || 'MY_FILTER',
          action,
          score: newScore,
          reason: 'Explanation here'
        }]
      };
    });
  }

  // Legacy method - filters don't generate cards
  async getWeightedCards() { throw new Error('Use transform() via Pipeline'); }
}
```

Register in `NavigatorRoles` as `NavigatorRole.FILTER`.

---

## Strategy State Storage

Strategies can persist user-scoped state (preferences, learned patterns, temporal tracking)
using the `STRATEGY_STATE` document type in the user database.

### Goals vs Preferences vs Inferred

The system distinguishes three types of user-scoped navigation data:

| Type | Defines | Example | Affects ELO | Implementation |
|------|---------|---------|-------------|----------------|
| **Goal** | Destination (what to learn) | "Master ear-training" | Yes | `userGoal.ts` (stub) |
| **Preference** | Path (how to learn) | "Skip text-heavy cards" | No | `filters/userTagPreference.ts` |
| **Inferred** | Learned patterns | "User prefers visual" | No | `inferredPreference.ts` (stub) |

- **Goals** redefine the optimization target — they scope which content matters for progress
- **Preferences** constrain the path — they affect card selection without changing progress tracking
- **Inferred** preferences are learned from behavior — they act as soft suggestions

See stub files for detailed architectural intent on goals and inferred preferences.

### Storage API

`ContentNavigator` provides protected helper methods:

```typescript
// Get this strategy's persisted state for the current course
protected async getStrategyState<T>(): Promise<T | null>

// Persist this strategy's state for the current course  
protected async putStrategyState<T>(data: T): Promise<void>

// Override to customize the storage key (default: constructor name)
protected get strategyKey(): string
```

### Document Format

```typescript
interface StrategyStateDoc<T> {
  _id: StrategyStateId;  // "STRATEGY_STATE::{courseId}::{strategyKey}"
  docType: DocType.STRATEGY_STATE;
  courseId: string;
  strategyKey: string;
  data: T;               // Strategy-specific payload
  updatedAt: string;
}
```

### Example: User Tag Preferences

`UserTagPreferenceFilter` reads user preferences from strategy state:

```typescript
interface UserTagPreferenceState {
  /**
   * Tag-specific multipliers.
   * - 0 = exclude (card score = 0)
   * - 0.5 = penalize by 50%
   * - 1.0 = neutral/no effect
   * - 2.0 = 2x preference boost
   * - Higher = stronger preference
   */
  boost: Record<string, number>;
  updatedAt: string;
}

// In filter's transform():
const prefs = await this.getStrategyState<UserTagPreferenceState>();
if (!prefs || Object.keys(prefs.boost).length === 0) {
  return cards; // No preferences configured
}

// Apply multipliers (max wins when multiple tags match)
const multiplier = computeMultiplier(cardTags, prefs.boost);
return { ...card, score: card.score * multiplier };
```

**UI Component**: `packages/common-ui/src/components/UserTagPreferences.vue`
- Slider-based interface (0-2 default range, expandable to 10)
- All sliders share global max for consistent visual comparison
- Writes to strategy state via `userDB.putStrategyState()`

---

## File Reference

| File | Purpose |
|------|---------|
| `core/navigators/index.ts` | `ContentNavigator`, `WeightedCard`, `NavigatorRole` |
| `core/navigators/generators/types.ts` | `CardGenerator`, `GeneratorContext` |
| `core/navigators/filters/types.ts` | `CardFilter`, `FilterContext` |
| `core/navigators/Pipeline.ts` | Pipeline orchestration |
| `core/navigators/PipelineAssembler.ts` | Builds Pipeline from strategy docs |
| `core/navigators/CompositeGenerator.ts` | Merges multiple generators |
| `core/navigators/generators/elo.ts` | ELO generator |
| `core/navigators/generators/srs.ts` | SRS generator (with backlog pressure) |
| `core/navigators/hardcodedOrder.ts` | Fixed-order generator |
| `core/navigators/hierarchyDefinition.ts` | Prerequisite filter |
| `core/navigators/interferenceMitigator.ts` | Interference filter |
| `core/navigators/relativePriority.ts` | Priority filter |
| `core/navigators/filters/eloDistance.ts` | ELO distance filter |
| `core/navigators/filters/userTagPreference.ts` | User tag preference filter |
| `common-ui/.../UserTagPreferences.vue` | UI for tag preference sliders |
| `core/navigators/userGoal.ts` | User goal navigator (stub) |
| `core/navigators/inferredPreference.ts` | Inferred preference navigator (stub) |
| `core/types/strategyState.ts` | `StrategyStateDoc`, `StrategyStateId` |
| `impl/couch/courseDB.ts` | `createNavigator()` entry point |
| `core/orchestration/index.ts` | OrchestrationContext, deviation logic |
| `core/orchestration/gradient.ts` | Gradient computation |
| `core/orchestration/learning.ts` | Weight updates, period orchestration |
| `core/orchestration/signal.ts` | Outcome signal computation |
| `core/orchestration/recording.ts` | User outcome recording |
| `core/types/learningState.ts` | `StrategyLearningState` |
| `core/types/userOutcome.ts` | `UserOutcomeRecord` |
| `express/routes/orchestration.ts` | Observability API endpoints |

## Related Documentation

- `todo-strategy-authoring.md` — UX and DX for authoring strategies
- `todo-review-adaptation.md` — Planned per-user review urgency adaptation
- `future-orchestration-vision.md` — Long-term adaptive strategy vision (beyond current implementation)
- `devlog/1004` — Implementation details for tag hydration optimization
- `devlog/1032-orchestrator` — Evolutionary orchestration implementation details