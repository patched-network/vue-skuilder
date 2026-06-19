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
  score: number;              // suitability; anchored at [0,1] but unbounded above (see Score Semantics)
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
- `SRSNavigator` — Review cards scored by overdueness, interval recency, and a multiplicative **backlog pressure** (base urgency ~0.5–0.95, scaled up by the backlog multiplier — can exceed 1.0)
- `PrescribedCardsGenerator` — Stateful generator for authored, course-prescribed content (e.g. intro cards that must eventually surface). Tracks whether prescribed targets have been encountered, applies progressive pressure to stale/pending target groups, can emit upstream support cards to satisfy prereqs of still-blocked targets, and drills unlocked-but-under-practiced skills under a **practice-debt pressure** (base ×2 escalating with debt age, capped — a persistent, self-discharging analog of SRS backlog pressure that guarantees a minimum number of reps land after intro). Registered as `prescribed`. See `generators/prescribed.ts`.
- `CompositeGenerator` — Merges multiple generators with frequency boost

#### SRS Backlog Pressure

The SRS generator implements a self-regulating **backlog pressure** mechanism that prevents review pile-up while maintaining healthy new/review balance.

Each review's per-card urgency is `base 0.5 + (overdueness/recency factors)·0.45` → ~0.5–0.95. Backlog pressure then **multiplies** that urgency by a global factor that grows as the due pile exceeds the healthy threshold (default `MAX_BACKLOG_MULTIPLIER = 2.0`, reached at 3× healthy):

- **Healthy backlog** (≤20 due reviews): ×1.0 — no boost, scores ~0.5–0.95. New content (ELO) naturally dominates.
- **Elevated backlog** (40 due): ×1.5 — scores ~0.85–1.4. Reviews compete with new cards.
- **High backlog** (60+ due): ×2.0 (max) — scores ~1.1–1.9. Reviews take priority.

**Why multiplicative, and not clamped to 1.0:** review scores are *not* capped at 1.0. They are designed to be cross-comparable with new-card scores, which are themselves no longer [0,1]-bounded — session hints multiply scores (an intro can boost its exercise tag ×5+), and `SessionController` draws one rank-ordered supply queue where reviews and new compete on a single open scale (see `decision-single-supply-queue.md`). A flat additive `+0.5` (the previous design) was both too small to contend with such boosts and largely swallowed by the old 1.0 clamp. A bounded multiplier scales review priority onto the same open scale, so a heavy backlog can genuinely lift reviews into contention; the cap (not a score ceiling) is what keeps them from running away.

This treats SRS scheduling times as **eligibility dates** rather than hard due dates—reviewing slightly later may be optimal. The system maintains a healthy backlog rather than always clearing to zero (avoiding "Anki death spiral").

Configuration via strategy `serializedData`:
```json
{ "healthyBacklog": 20 }
```

`MAX_BACKLOG_MULTIPLIER` is currently a module constant in `generators/srs.ts` (tune against the dbg overlay's "review backpressure" panel). See `todo-review-adaptation.md` for planned per-user adaptation extensions.

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

    cards = cards.filter(c => c.score > 0);

    // Stage 3: diversity re-rank (post-filter, pre-sort)
    cards = diversityRerank(cards);

    return cards.sort((a, b) => b.score - a.score)
                .slice(0, limit);
  }
}
```

**Responsibilities:**
- **Context building** — Fetches shared data (user ELO, orchestration context) once for all strategies
- **Data hydration** — Pre-fetches commonly needed data (tags) in batch queries
- **Filter orchestration** — Applies filters in sequence, accumulating provenance
- **Diversity re-rank** — Demotes repeated answers/concepts so no one tag monopolises the head of the queue (see below)
- **Result selection** — Removes zero-scores, sorts, and returns top N

### Diversity Re-rank (Stage 3)

A first-class stage that runs **after** the filter chain on the final scores. The
three-stage model is: generators *produce* → filters *weigh* → re-rank
*diversifies*. It exists to break "ruts" where many top-scoring candidates share
the same answer (e.g. a run of missing-letter cards that all resolve to `i`), so
the learner can't go on autopilot pressing one key.

**Why a separate stage, not a filter:** filters are documented as
order-independent multipliers (see [Score Semantics](#score-semantics)). The
re-rank is *rank-dependent* — a card's penalty depends on what outscored it — so
it deliberately sits outside the commutative filter chain, running last.

**Tag-agnostic by construction.** Tags are the only structured similarity signal
the framework has, so the re-rank operates on tags — but privileges none. It
weights each shared tag by its rarity in the candidate pool (inverse document
frequency): ubiquitous scaffolding tags (`ui:*`, incidental `gpc:expose:*`)
contribute ~0, while the distinctive tag a cluster shares dominates. No namespace
is hardcoded, so any course benefits for free *provided its sameness axis is
tagged* ("tag-agnostic" = no tag is special, not "needs no tags").

**Algorithm** (greedy maximal-marginal-relevance): walk candidates in score
order; a candidate's repetition load is `Σ idf[tag]·(#already-emitted cards with
tag)`; emit `argmax(score / (1 + strength·load))` each step, flooring the penalty
so a strong-but-repeated card is never driven under downstream "well-indicated"
thresholds. Penalties are expressed as **scores** (not a positional shuffle) so
the ordering survives both the Pipeline's final sort and the `SourceMixer`'s
score-descending re-sort downstream.

Per-source: the stage lives inside each Pipeline run, so in multi-source sessions
it diversifies each source's contribution before the mixer interleaves sources.
Two global knobs (`strength`, `floor`) have course-general defaults; promote to
strategy `serializedData` if you want them learnable under orchestration.

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
| 1.0 | Fully suitable (the generator anchor, **not** a ceiling) |
| 0.5 | Neutral |
| 0.0 | Exclude (hard filter) |
| 0.x | Proportional suitability |
| >1.0 | Boosted / elevated-urgency — above the nominal "fully suitable" anchor |
| +INF | Mandatory — a required card injected by a `requireCards`/`requireTags` hint |

**1.0 is an anchor, not a cap.** Generators emit in ~[0,1], but the final score is an *open* scale: multiplicative filters and session hints can push scores above 1.0 (an intro boosting its exercise tag ×5), and the SRS backlog multiplier lifts urgent reviews past 1.0 under heavy backlog. This is deliberate — it lets reviews and new cards compete on one cross-comparable scale, which is what `SessionController`'s single supply queue draws against (see `decision-single-supply-queue.md`). `+INF` is the require-injection sentinel; such cards float to the head of the supply.

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

Strategies can be defined in two places:

- **Framework-internal:** Added directly to `NavigatorRoles` in `index.ts`. Used
  for general-purpose strategies shipped with the framework.
- **Consumer-defined:** Registered at app startup via `registerNavigator()`.
  Used for course-specific strategies that live in the consumer codebase.

Both types participate identically in the pipeline once registered.

### Registration

Framework-internal strategies are listed in the hardcoded `NavigatorRoles` record.
Consumer-defined strategies use the public `registerNavigator()` API:

```typescript
import { registerNavigator, NavigatorRole } from '@vue-skuilder/db';
import { MyFilter } from './MyFilter';

// At app init, before any study session:
registerNavigator('myFilter', MyFilter, NavigatorRole.FILTER);
```

The third argument (`role`) is **required** for consumer-defined strategies —
without it, `PipelineAssembler` cannot classify the strategy and will skip it
with a warning. For framework-internal strategies the role is already in
`NavigatorRoles`, so the argument is optional.

A corresponding `NAVIGATION_STRATEGY` document must exist in CouchDB with
`implementingClass` matching the registered name:

```json
{
  "_id": "NAVIGATION_STRATEGY-my-filter",
  "implementingClass": "myFilter",
  "name": "My Filter",
  "serializedData": "{}"
}
```

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

### Accessing Strategy State from Consumer Filters

Consumer strategies can share state with other parts of the consumer app via
`getStrategyState()` / `putStrategyState()`. Override `strategyKey` to read
an existing state document:

```typescript
class MyFilter extends ContentNavigator implements CardFilter {
  // Read the same doc that another part of the app writes
  protected get strategyKey(): string {
    return 'MySharedStateKey';
  }

  async transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]> {
    const state = await this.getStrategyState<MyStateType>();
    // ... use state for filtering decisions
  }
}
```

This enables **single source of truth** patterns: the consumer app writes state
through the course-scoped interface, which is reached via the **async**
`getCourseInterface(courseId)` (await it first — it returns a `Promise`):

```typescript
const courseDb = await userDB.getCourseInterface(courseId);
await courseDb.putStrategyState<MyStateType>('MySharedStateKey', data);
```

The consumer filter then reads it via the same key. No framework changes needed.

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
| `core/navigators/diversityRerank.ts` | Diversity re-rank stage (IDF-weighted MMR, pipeline stage 3) |
| `core/navigators/PipelineAssembler.ts` | Builds Pipeline from strategy docs |
| `core/navigators/CompositeGenerator.ts` | Merges multiple generators |
| `core/navigators/generators/elo.ts` | ELO generator |
| `core/navigators/generators/srs.ts` | SRS generator (multiplicative backlog pressure) |
| `core/navigators/generators/prescribed.ts` | Prescribed-content generator (authored targets, support cards, practice drilling) |
| `core/navigators/SrsDebugger.ts` | Per-run SRS backlog capture for the session overlay |
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
