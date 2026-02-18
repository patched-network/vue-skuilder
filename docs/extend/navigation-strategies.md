# Extending Navigation Strategies

This guide covers how to create custom navigation strategies for content selection and ordering.

## Overview

Navigation strategies control **which cards** surface during study sessions and **how** they are scored. The system uses a pipeline architecture:

```
Pipeline = Generator(s) + Filter(s)
         = [Candidate Production] → [Score Transformation]
```

- **Generators** produce candidate cards with initial scores
- **Filters** transform scores (boost, penalize, or exclude)

All strategies produce `WeightedCard` objects with scores from 0-1 and a provenance trail explaining the scoring.

## WeightedCard

The core data type for scored candidates:

```typescript
interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;              // 0-1 suitability score
  provenance: StrategyContribution[];
  tags?: string[];            // Pre-fetched by Pipeline
}

interface StrategyContribution {
  strategy: string;           // Type: 'elo', 'srs', 'myCustom'
  strategyName: string;       // Human-readable: "My Custom Navigator"
  strategyId: string;         // Document ID
  action: 'generated' | 'passed' | 'boosted' | 'penalized';
  score: number;              // Score after this strategy
  reason: string;             // Human-readable explanation
}
```

## Creating a Generator

Generators produce candidate cards. They are responsible for:
- Identifying cards that should be considered
- Assigning initial suitability scores
- Providing provenance for transparency

### Example: Custom Generator

```typescript
import { ContentNavigator, WeightedCard, GeneratorContext, CardGenerator } from '@vue-skuilder/db';

export class RecentFailuresGenerator extends ContentNavigator implements CardGenerator {
  name = 'Recent Failures';

  async getWeightedCards(limit: number, context?: GeneratorContext): Promise<WeightedCard[]> {
    // Find cards the user failed recently
    const recentFailures = await this.findRecentFailures(limit);
    
    return recentFailures.map(card => ({
      cardId: card.id,
      courseId: this.course.getCourseID(),
      score: this.computeScore(card),
      provenance: [{
        strategy: 'recentFailures',
        strategyName: this.name,
        strategyId: this.strategyId || 'RECENT_FAILURES_GENERATOR',
        action: 'generated',
        score: this.computeScore(card),
        reason: `Failed ${card.failureCount}x in last ${card.daysSinceFailure} days, review card`
      }]
    }));
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

Filters transform scores from upstream. They are pure functions (no side effects) that receive cards with pre-hydrated data (tags, etc.) and return modified cards.

### Score Semantics

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

### Example: Custom Filter

```typescript
import { ContentNavigator, WeightedCard, FilterContext, CardFilter } from '@vue-skuilder/db';

export class TimeSinceTagFilter extends ContentNavigator implements CardFilter {
  name = 'Time Since Tag';

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
  strategyType: string;       // Maps to NavigatorRoles key
  name: string;               // Human-readable name
  description?: string;
  serializedData?: string;    // JSON config for strategy-specific settings
  
  // Evolutionary orchestration (optional)
  learnable?: LearnableWeight;
  staticWeight?: boolean;     // If true, not subject to automatic tuning
}
```

### Custom Configuration

Define a config interface and parse it in your strategy:

```typescript
interface TimeSinceTagConfig {
  recentPenalty: number;      // Multiplier for recently-seen tags
  staleBooost: number;        // Multiplier for stale tags
  staleThresholdDays: number; // Days before "stale"
}

export class TimeSinceTagFilter extends ContentNavigator implements CardFilter {
  private config: TimeSinceTagConfig;

  constructor(/* ... */) {
    super(/* ... */);
    this.config = this.parseConfig();
  }

  private parseConfig(): TimeSinceTagConfig {
    const defaults: TimeSinceTagConfig = {
      recentPenalty: 0.5,
      staleBoost: 1.2,
      staleThresholdDays: 7,
    };
    
    if (!this.serializedData) return defaults;
    try {
      return { ...defaults, ...JSON.parse(this.serializedData) };
    } catch {
      return defaults;
    }
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

Assembly logic:
1. Separate strategies by `NavigatorRole` (generator vs filter)
2. Wrap multiple generators in `CompositeGenerator`
3. Sort filters alphabetically for determinism
4. Return `Pipeline(generator, filters)`

## Built-In Strategies Reference

### Generators

| Strategy | Purpose | Config |
|----------|---------|--------|
| `ELONavigator` | New cards by skill proximity | Window size, target offset |
| `SRSNavigator` | Review cards by schedule + backlog pressure | `healthyBacklog` (default: 20) |
| `HardcodedOrderNavigator` | Fixed sequence | Card ID list |

#### SRS Backlog Pressure

The SRS generator implements **backlog pressure** to prevent review pile-up. When the number of due reviews exceeds a "healthy" threshold (default: 20), all review scores receive a global boost:

- At healthy backlog (≤20): no boost, scores 0.5-0.95
- At 2× healthy (40): +0.25 boost, scores 0.75-1.0
- At 3×+ healthy (60+): +0.50 boost (max), scores 0.95-1.0

This allows high-urgency reviews to compete with new cards (which score up to 1.0 from ELO). The system is self-regulating: as users work through reviews, backlog drops, pressure decreases, and new content reappears.

Configure via `serializedData`:

```typescript
// In strategy document
{
  strategyType: 'srs',
  name: 'SRS',
  serializedData: JSON.stringify({ healthyBacklog: 30 })  // Override default
}
```

### Filters

| Strategy | Purpose | Config |
|----------|---------|--------|
| `HierarchyDefinitionNavigator` | Prerequisite gating | Tag prerequisites, thresholds |
| `InterferenceMitigatorNavigator` | Confusable concept separation | Interference sets, decay |
| `RelativePriorityNavigator` | Priority ordering | Tag priorities, combine mode |
| `UserTagPreferenceFilter` | User-configured preferences | (Reads from strategy state) |
| `EloDistanceFilter` | Penalize far-from-skill cards | Distance penalty curve |

## File Reference

| File | Purpose |
|------|---------|
| `packages/db/src/core/navigators/index.ts` | `ContentNavigator`, roles, types |
| `packages/db/src/core/navigators/generators/types.ts` | `CardGenerator`, `GeneratorContext` |
| `packages/db/src/core/navigators/filters/types.ts` | `CardFilter`, `FilterContext` |
| `packages/db/src/core/navigators/Pipeline.ts` | Pipeline orchestration |
| `packages/db/src/core/navigators/PipelineAssembler.ts` | Assembly from strategy docs |
| `packages/db/src/core/navigators/CompositeGenerator.ts` | Merge multiple generators |

## Related Documentation

- [Pedagogy System](../learn/pedagogy) — Overall adaptive learning system
- [Custom Cards](./custom-cards) — Creating new card types