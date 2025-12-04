# Navigation Strategy Architecture

## Overview

The navigation strategy system selects and scores cards for study sessions. It uses a
**Pipeline architecture** where generators produce candidates and filters transform scores.

## Core Concepts

### WeightedCard

A card with a suitability score and audit trail:

```typescript
interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;              // 0-1 suitability score
  provenance: StrategyContribution[];  // Audit trail
}

interface StrategyContribution {
  strategy: string;           // Type: 'elo', 'srs', 'hierarchyDefinition'
  strategyName: string;       // Human-readable: "ELO (default)"
  strategyId: string;         // Document ID: 'NAVIGATION_STRATEGY-ELO-default'
  action: 'generated' | 'passed' | 'boosted' | 'penalized';
  score: number;              // Score after this strategy
  reason: string;             // Human-readable explanation
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
- `ELONavigator` — New cards scored by ELO proximity to user skill
- `SRSNavigator` — Review cards scored by overdueness and interval recency
- `HardcodedOrderNavigator` — Fixed sequence defined by course author
- `CompositeGenerator` — Merges multiple generators with frequency boost

### CardFilter

Transforms card scores (pure function, no side effects):

```typescript
interface CardFilter {
  name: string;
  transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]>;
}
```

**Implementations:**
- `HierarchyDefinitionNavigator` — Gates cards by prerequisite mastery (score=0 if locked)
- `InterferenceMitigatorNavigator` — Reduces scores for confusable content
- `RelativePriorityNavigator` — Boosts scores for high-utility content
- `createEloDistanceFilter()` — Penalizes cards far from user's current ELO

### Pipeline

Orchestrates generator and filters:

```typescript
class Pipeline {
  constructor(
    generator: CardGenerator,
    filters: CardFilter[],
    user: UserDBInterface,
    course: CourseDBInterface
  )

  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    const context = await this.buildContext();
    let cards = await this.generator.getWeightedCards(fetchLimit, context);
    
    for (const filter of this.filters) {
      cards = await filter.transform(cards, context);
    }
    
    return cards.filter(c => c.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
  }
}
```

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
    reason: 'Prerequisites met, tags: letter-sounds'
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

  // Legacy methods - stub or implement for backward compat
  async getNewCards() { return []; }
  async getPendingReviews() { return []; }
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

  // Legacy methods - filters don't generate cards
  async getWeightedCards() { throw new Error('Use transform() via Pipeline'); }
  async getNewCards() { return []; }
  async getPendingReviews() { return []; }
}
```

Register in `NavigatorRoles` as `NavigatorRole.FILTER`.

## File Reference

| File | Purpose |
|------|---------|
| `core/navigators/index.ts` | `ContentNavigator`, `WeightedCard`, `NavigatorRole` |
| `core/navigators/generators/types.ts` | `CardGenerator`, `GeneratorContext` |
| `core/navigators/filters/types.ts` | `CardFilter`, `FilterContext` |
| `core/navigators/Pipeline.ts` | Pipeline orchestration |
| `core/navigators/PipelineAssembler.ts` | Builds Pipeline from strategy docs |
| `core/navigators/CompositeGenerator.ts` | Merges multiple generators |
| `core/navigators/elo.ts` | ELO generator |
| `core/navigators/srs.ts` | SRS generator |
| `core/navigators/hardcodedOrder.ts` | Fixed-order generator |
| `core/navigators/hierarchyDefinition.ts` | Prerequisite filter |
| `core/navigators/interferenceMitigator.ts` | Interference filter |
| `core/navigators/relativePriority.ts` | Priority filter |
| `core/navigators/filters/eloDistance.ts` | ELO distance filter |
| `impl/couch/courseDB.ts` | `createNavigator()` entry point |

## Related TODOs

- `todo-pipeline-optimization.md` - Batch tag hydration for filter efficiency
- `todo-strategy-authoring.md` - ux and dx for authoring strategies
- todo-pipeline-optimization.md - 
- todo-strategy-state-storage
- todo-evolutionary-orchestration