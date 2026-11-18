# Extending Navigation Strategies

This guide covers how to create custom navigation strategies for content selection and ordering.

## Overview

Navigation strategies control **which cards** surface during study sessions and **how** they are scored. Each planning run goes through these stages:

```
Generate → Filter → Drop zeros → Regulate → Hints → Diversity re-rank → Select
```

- **Generators** produce candidate cards with initial scores
- **Filters** multiply scores: boost, penalize, or exclude (score 0)

The other stages are fixed framework behaviour; [Pedagogy System](../learn/pedagogy) describes them. You extend the pipeline by writing generators and filters.

All strategies produce `WeightedCard` objects, each with a score and a provenance trail explaining it.

## WeightedCard

The core data type for scored candidates:

```typescript
interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;              // suitability; usually 0-1 (see Score Semantics)
  provenance: StrategyContribution[];
  tags?: string[];            // Pre-fetched by Pipeline before filters run
  reviewID?: string;          // Set by review generators; makes the card a review
  cardElo?: number;           // Card's global ELO, if the generator already has it
  reviewUrgency?: number;     // SRS urgency in [0, 1], read by the review-mass regulator
  skillFetch?: { tag: string; pressure: number };  // set by the ELO generator's skill fetch
}

interface StrategyContribution {
  strategy: string;           // Type: 'elo', 'srs', 'myCustom'
  strategyName: string;       // Human-readable: "My Custom Navigator"
  strategyId: string;         // Document ID
  action: 'generated' | 'passed' | 'boosted' | 'penalized';
  score: number;              // Score after this strategy
  reason: string;             // Human-readable explanation
  effectiveWeight?: number;   // Set when evolutionary orchestration weighted it
  deviation?: number;
}
```

A card is a **review** if it carries `reviewID`; otherwise it is new. Regulators and session
summaries use that distinction.

## Creating a Generator

Generators produce candidate cards. They are responsible for:
- Identifying cards that should be considered
- Assigning initial suitability scores
- Providing provenance for transparency

### Example: Custom Generator

```typescript
import {
  ContentNavigator,
  type CardGenerator,
  type GeneratorContext,
  type GeneratorResult,
} from '@vue-skuilder/db';

export class RecentFailuresGenerator extends ContentNavigator implements CardGenerator {
  name = 'Recent Failures';

  async getWeightedCards(limit: number, context: GeneratorContext): Promise<GeneratorResult> {
    // Find cards the user failed recently
    const recentFailures = await this.findRecentFailures(limit);

    const cards = recentFailures.map(card => ({
      cardId: card.id,
      courseId: this.course.getCourseID(),
      score: this.computeScore(card),
      provenance: [{
        strategy: 'recentFailures',
        strategyName: this.name,
        strategyId: this.strategyId || 'RECENT_FAILURES_GENERATOR',
        action: 'generated',
        score: this.computeScore(card),
        reason: `Failed ${card.failureCount}x in last ${card.daysSinceFailure} days`
      }]
    }));
    return { cards: cards.sort((a, b) => b.score - a.score) };
  }

  private async findRecentFailures(limit: number) {
    // Implementation: query user history for recent failures
    // ...
  }

  private computeScore(card: { failureCount: number; daysSinceFailure: number }): number {
    // Higher score for more recent, more frequent failures
    const recency = Math.exp(-card.daysSinceFailure / 7);  // Decay over a week
    const frequency = Math.min(card.failureCount / 5, 1);  // Cap at 5 failures
    return (recency + frequency) / 2;
  }
}
```

`GeneratorContext` carries `user`, `course`, `userElo` (global), `userCourseElo` (global and
per-tag ratings with evidence buffers, when readable), `orchestration` and `sessionId`. A
generator may also return `hints` (`ReplanHints`: boost, require or exclude cards or tags) to
shape the rest of the run without listing every affected card itself. The Composite generator
merges every generator's cards and keeps the top 500.

### Registering a Generator

Consumer-defined generators are registered at app startup via the public API:

```typescript
import { registerNavigator, NavigatorRole } from '@vue-skuilder/db';

// At app init, before any study session:
registerNavigator('recentFailures', RecentFailuresGenerator, NavigatorRole.GENERATOR);
```

The `role` parameter is **required** for consumer-defined strategies — without
it, `PipelineAssembler` cannot classify the strategy into the pipeline and will
skip it with a warning.

A corresponding `NAVIGATION_STRATEGY` document must exist in CouchDB:

```json
{
  "_id": "NAVIGATION_STRATEGY-recent-failures",
  "implementingClass": "recentFailures",
  "name": "Recent Failures Generator",
  "serializedData": "{}"
}
```

> **Framework-internal strategies** are instead added directly to the
> `NavigatorRoles` record in `packages/db/src/core/navigators/index.ts`. Their
> roles are resolved from the hardcoded enum, so the `role` parameter is
> optional when calling `registerNavigator`.

## Creating a Filter

Filters transform scores from upstream. They are pure transforms (no side effects beyond provenance) that receive cards with pre-hydrated data (tags, etc.) and return modified cards.

### Score Semantics

| Score | Meaning |
|-------|---------|
| > 1.0 | Boosted (allowed: a curriculum generator or a boost may lift a card above 1) |
| 1.0 | Fully suitable |
| 0.x | Proportional suitability |
| 0.0 | Exclude: dropped after the filter stage, with provenance saying why |

**All filters are multipliers.** This means:
- Filter order doesn't affect final scores (multiplication is commutative)
- Score 0 from any filter excludes the card
- Filters run sorted by name, for deterministic provenance order

### Filter kind

Declare what your penalties mean with `kind`:

- **`gate`**: the card isn't ready yet (prerequisites, lessons, unlocks).
- **`signal`**: a preference (priority, interference, difficulty, pressure).

The intake regulator lifts only new cards that no gate penalized, so pressure for new content
never overrides "not ready". A filter that declares no kind counts as a gate. Declare it
statically too (`static readonly kind`), so the pipeline plan can read it without an instance.

Set `liveOnly = true` if the filter only makes sense on a real run. Forecasts and card-space scans
start every card at 1.0 without a generator, and skip such filters (ELO distance is one).

### Example: Custom Filter

```typescript
import {
  ContentNavigator,
  type CardFilter,
  type FilterContext,
  type FilterKind,
  type WeightedCard,
} from '@vue-skuilder/db';

export class TimeSinceTagFilter extends ContentNavigator implements CardFilter {
  name = 'Time Since Tag';
  static readonly kind: FilterKind = 'signal';
  readonly kind = TimeSinceTagFilter.kind;

  async transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]> {
    const tagLastSeen = await this.getTagLastSeenTimes();
    
    return cards.map(card => {
      const multiplier = this.computeMultiplier(card.tags || [], tagLastSeen);
      const newScore = card.score * multiplier;
      const action = multiplier < 1 ? 'penalized' : multiplier > 1 ? 'boosted' : 'passed';
      
      return {
        ...card,
        score: newScore,
        provenance: [...card.provenance, {
          strategy: 'timeSinceTag',
          strategyName: this.name,
          strategyId: this.strategyId || 'TIME_SINCE_TAG_FILTER',
          action,
          score: newScore,
          reason: this.explainMultiplier(multiplier, card.tags)
        }]
      };
    });
  }

  private computeMultiplier(tags: string[], lastSeen: Record<string, Date>): number {
    // Boost cards with tags not seen recently
    let minTimeSinceMs = Infinity;
    for (const tag of tags) {
      const seen = lastSeen[tag];
      if (seen) {
        minTimeSinceMs = Math.min(minTimeSinceMs, Date.now() - seen.getTime());
      }
    }
    
    if (minTimeSinceMs === Infinity) return 1.0;  // Unknown tags: neutral
    
    const daysSince = minTimeSinceMs / (1000 * 60 * 60 * 24);
    if (daysSince < 0.1) return 0.5;  // Very recent: penalize
    if (daysSince > 7) return 1.2;    // Over a week: boost
    return 1.0;                        // Otherwise: neutral
  }

  private explainMultiplier(mult: number, tags?: string[]): string {
    if (mult < 1) return `Tags ${tags?.join(', ')} seen recently → ${mult.toFixed(2)}x`;
    if (mult > 1) return `Tags ${tags?.join(', ')} not seen for 7+ days → ${mult.toFixed(2)}x`;
    return 'Neutral timing';
  }

  // Legacy method - filters don't generate cards
  async getWeightedCards() { throw new Error('Use transform() via Pipeline'); }
}
```

### Registering a Filter

```typescript
import { registerNavigator, NavigatorRole } from '@vue-skuilder/db';

// At app init, before any study session:
registerNavigator('timeSinceTag', TimeSinceTagFilter, NavigatorRole.FILTER);
```

As with generators, a `NAVIGATION_STRATEGY` document with matching
`implementingClass` must exist in CouchDB for the filter to be included in
pipeline assembly.

## Strategy Configuration

Strategies are stored as documents and can be configured via JSON:

```typescript
interface ContentNavigationStrategyData {
  _id: `NAVIGATION_STRATEGY-${string}`;
  docType: DocType.NAVIGATION_STRATEGY;
  implementingClass: string;  // The name the class was registered under
  name: string;               // Human-readable name (shown in provenance)
  description: string;
  serializedData: string;     // JSON config for strategy-specific settings ('' or '{}' for defaults)

  // Evolutionary orchestration (optional)
  learnable?: LearnableWeight;
  staticWeight?: boolean;     // If true, not subject to automatic tuning
}
```

### Custom Configuration

Define a config interface and parse it from `strategyData.serializedData` in your constructor,
as the built-in strategies do:

```typescript
interface TimeSinceTagConfig {
  recentPenalty: number;      // Multiplier for recently-seen tags
  staleBoost: number;         // Multiplier for stale tags
  staleThresholdDays: number; // Days before "stale"
}

export class TimeSinceTagFilter extends ContentNavigator implements CardFilter {
  private config: TimeSinceTagConfig;

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ) {
    super(user, course, strategyData);
    this.config = parseConfig(strategyData.serializedData);
  }
}

function parseConfig(serializedData: string | undefined): TimeSinceTagConfig {
  const defaults: TimeSinceTagConfig = {
    recentPenalty: 0.5,
    staleBoost: 1.2,
    staleThresholdDays: 7,
  };
  if (!serializedData) return defaults;
  try {
    return { ...defaults, ...JSON.parse(serializedData) };
  } catch {
    return defaults;
  }
}
```

## Strategy State Storage

Strategies can persist user-scoped state using `StrategyStateDoc`:

```typescript
// In your strategy
const state = await this.getStrategyState<MyStateType>();
await this.putStrategyState({ ...state, lastRun: new Date().toISOString() });
```

State is stored per-user, per-course, per-strategy at:
```
STRATEGY_STATE::{courseId}::{strategyKey}
```

The `strategyKey` defaults to the class constructor name but can be overridden.
Useful for:
- User preferences
- Temporal tracking ("last time tag X was introduced")
- Learned patterns

### Sharing State with Consumer Application Code

Consumer-defined strategies can share state with other parts of the consumer
app by overriding `strategyKey` to match a key used elsewhere:

```typescript
class LetterGatingFilter extends ContentNavigator implements CardFilter {
  // Read the same document that the app's userState service writes
  protected get strategyKey(): string {
    return 'LetterProgression';
  }

  async transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]> {
    const progression = await this.getStrategyState<LetterProgressionState>();
    const unlocked = new Set(progression?.unlockedLetters ?? []);

    return cards.map(card => {
      // Gate cards based on shared state...
    });
  }
}
```

This enables a **single source of truth** pattern: the consumer app writes
state via `UsrCrsDataInterface.putStrategyState(key, data)`, and the consumer
filter reads it through the same key. Both resolve to the same PouchDB
document, so there is no drift between UI state and navigation decisions.

## Evolutionary Orchestration

Strategies can carry **learnable weights** that automatically tune toward optimal effectiveness:

```typescript
interface LearnableWeight {
  weight: number;       // Peak value, 1.0 = neutral
  confidence: number;   // 0-1, controls exploration width
  sampleSize: number;   // Observations collected
}
```

When `learnable` is set, the orchestration layer:
1. Distributes users across a weight range (bell curve around peak)
2. Records learning outcomes per user
3. Correlates user deviation with outcomes via gradient estimation
4. Updates peak weight toward observed optimum
5. Increases confidence as observations accumulate

Set `staticWeight: true` for foundational strategies that should not be tuned.

## Pipeline Assembly

The `PipelineAssembler` builds pipelines from strategy documents:

```typescript
const assembler = new PipelineAssembler();
const { pipeline, warnings } = await assembler.assemble({
  strategies: allStrategies,
  user,
  course,
});

const cards = await pipeline.getWeightedCards(10);
```

Assembly logic (`pipelinePlan.ts` computes the same plan as data, which the admin pipeline view renders):
1. Separate strategies by `NavigatorRole` (generator vs filter); skip unknown implementing classes with a warning
2. Add an ELO and an SRS generator if absent (custom generators supplement them, never replace them), and an ELO distance filter if absent
3. Wrap the generators in `CompositeGenerator`
4. Sort filters by name
5. Return `Pipeline(generator, filters)`

The course DB caches the assembled pipeline for five minutes, or until a strategy doc is written.

## Built-In Strategies Reference

### Generators

| Strategy (`implementingClass`) | Purpose | Config (`serializedData`) |
|----------|---------|--------|
| `elo` | New cards from a window around the learner's global ELO, jitter-scored; plus a **skill fetch** of unseen cards for the most pressured skills, aimed below their ratings | `{ skillFetch: { enabled, maxSkills, perSkill, targetOffset, maxScan, ...SkillPressureConfig } }`; default on (3 skills × 4 cards, 250 below) |
| `srs` | Due reviews, scored by urgency: overdueness weighed by interval length | none (`healthyBacklog` is deprecated and ignored) |
| `prescribed` | Authored curriculum targets that must eventually surface, with escalating pressure on stale ones and support cards for blocked targets | target groups; see `generators/prescribed.ts` |

The ELO generator only retrieves. Distance from the learner is scored once, for new cards and
reviews alike, by the ELO distance filter.

### Filters

| Strategy (`implementingClass`) | Kind | Purpose |
|----------|------|---------|
| `eloDistance` | signal | Gaussian on card-vs-learner ELO gap, never zero; intro cards pass. Added by default. Optional tag-aware mode (experimental) |
| `hierarchyDefinition` | gate | Prerequisite gating on tag mastery (`minElo`, `minCount`) |
| `interferenceMitigator` | signal | Spaces confusable tags apart until mature |
| `relativePriority` | signal | Tag priorities, combine mode |
| `skillPressure` | signal | Up to ×(1 + gain) on a card's most pressured skill (need below the learner's skill median, or shaky/unproven). Opt-in |
| `userTagPreference` | signal | The learner's own tag boosts/penalties (reads strategy state) |

### Regulators (not strategies)

Backlog pressure used to live in the SRS generator. It is now a pipeline stage after the
filters, and it can't be configured per course yet:

- **Review mass** weighs the due backlog by urgency × filtered score. Above a healthy mass of 20
  card-equivalents, it lifts every review by `2^(excess / 20)`.
- **Intake** counts hours since a new card was last shown (only while one was available). It lifts
  new cards no gate penalized by `2^(hours / 24)`.

Readings are persisted on session run summaries. See `packages/db/src/core/navigators/regulators.ts`.

## File Reference

| File | Purpose |
|------|---------|
| `packages/db/src/core/navigators/index.ts` | `ContentNavigator`, roles, types |
| `packages/db/src/core/navigators/generators/types.ts` | `CardGenerator`, `GeneratorContext` |
| `packages/db/src/core/navigators/filters/types.ts` | `CardFilter`, `FilterContext` |
| `packages/db/src/core/navigators/Pipeline.ts` | Pipeline orchestration (all stages) |
| `packages/db/src/core/navigators/PipelineAssembler.ts` | Assembly from strategy docs |
| `packages/db/src/core/navigators/pipelinePlan.ts` | The plan as data; stage descriptions |
| `packages/db/src/core/navigators/generators/CompositeGenerator.ts` | Merge multiple generators |
| `packages/db/src/core/navigators/regulators.ts` | Review-mass and intake regulators |
| `packages/db/src/core/navigators/diversityRerank.ts` | Diversity re-rank stage |

## Related Documentation

- [Pedagogy System](../learn/pedagogy) — Overall adaptive learning system
- `packages/db/docs/navigators-architecture.md`, `multi-tag-elo-search.md` — framework internals
- [Custom Cards](./custom-cards) — Creating new card types