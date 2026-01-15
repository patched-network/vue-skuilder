# Resource: Pipeline Data Flow

This document captures the architecture of the content selection pipeline for study sessions.

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Study Session Startup                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SessionController.prepareSession()                                          │
│    → calls getWeightedContent()                                              │
│    → iterates over sources[] (each is a Pipeline)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
          ┌─────────────────┐                 ┌─────────────────┐
          │  Pipeline (A)   │                 │  Pipeline (B)   │
          │  (Course 1)     │                 │  (Course 2)     │
          └─────────────────┘                 └─────────────────┘
                    │                                   │
                    ▼                                   ▼
          ┌─────────────────┐                 ┌─────────────────┐
          │ getWeightedCards│                 │ getWeightedCards│
          └─────────────────┘                 └─────────────────┘
                    │                                   │
                    └─────────────────┬─────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SourceMixer.mix()                                                           │
│    → Combines weighted cards from all sources                                │
│    → Sorts by score, respects quotas                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Split by origin (getCardOrigin from provenance)                             │
│    → Reviews → reviewQ                                                       │
│    → New     → newQ                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Per-Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Pipeline.getWeightedCards(limit)                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. Build Context                                                            │
│     - Fetch user ELO for this course                                         │
│     - Create OrchestrationContext (for evolutionary weights)                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. Generator Phase                                                          │
│                                                                              │
│  CompositeGenerator.getWeightedCards(limit, context)                         │
│    ├── ELONavigator.getWeightedCards()  → NEW cards scored by ELO distance  │
│    └── SRSNavigator.getWeightedCards()  → REVIEW cards scored by urgency    │
│                                                                              │
│  Aggregation (FREQUENCY_BOOST mode):                                         │
│    - Deduplicate by cardId                                                   │
│    - Weighted average of scores                                              │
│    - Frequency boost: avg * (1 + 0.1 * (n-1))                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. Tag Hydration                                                            │
│     - Batch fetch tags for all candidate cards                               │
│     - Attach to card.tags[]                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. Filter Phase (sequential, order alphabetical)                            │
│                                                                              │
│  for each filter:                                                            │
│    cards = filter.transform(cards, context)                                  │
│                                                                              │
│  Example filters:                                                            │
│    - RelativePriorityNavigator ("Draft Priorities")                          │
│    - EloDistanceFilter                                                       │
│    - HierarchyDefinitionNavigator                                            │
│    - InterferenceMitigatorNavigator                                          │
│    - UserTagPreferenceFilter                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. Final Selection                                                          │
│     - Remove score=0 cards (hard filtered)                                   │
│     - Sort by score descending                                               │
│     - Take top N                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `packages/db/src/study/SessionController.ts` | Orchestrates session, calls pipelines, manages queues |
| `packages/db/src/core/navigators/Pipeline.ts` | Runs generator → filters → sorted results |
| `packages/db/src/core/navigators/PipelineAssembler.ts` | Builds Pipeline from strategy documents |
| `packages/db/src/core/navigators/generators/CompositeGenerator.ts` | Merges ELO + SRS generators |
| `packages/db/src/core/navigators/generators/elo.ts` | Scores NEW cards by ELO proximity |
| `packages/db/src/core/navigators/generators/srs.ts` | Scores REVIEW cards by urgency |
| `packages/db/src/core/navigators/filters/relativePriority.ts` | Boosts high-utility content |
| `packages/db/src/core/navigators/filters/eloDistance.ts` | Penalizes cards far from user ELO |
| `packages/db/src/study/SourceMixer.ts` | Mixes cards across multiple courses |

## Provenance Tracking

Every `WeightedCard` carries a `provenance: StrategyContribution[]` audit trail:

```typescript
interface StrategyContribution {
  strategy: string;       // 'elo', 'srs', 'relativePriority', etc.
  strategyName: string;   // Human-readable: "ELO (default)"
  strategyId: string;     // Document ID: 'NAVIGATION_STRATEGY-ELO-default'
  action: 'generated' | 'passed' | 'boosted' | 'penalized';
  score: number;          // Score AFTER this strategy's processing
  reason: string;         // Human-readable explanation
  effectiveWeight?: number;
  deviation?: number;     // Evolutionary orchestration
}
```

### Example Provenance Trail

```javascript
provenance: [
  {
    strategy: 'elo',
    strategyName: 'ELO (default)',
    action: 'generated',
    score: 0.95,
    reason: 'ELO distance 50 (card: 1050, user: 1000), new card'
  },
  {
    strategy: 'composite',
    strategyName: 'Composite Generator',
    action: 'passed',
    score: 0.95,
    reason: 'Single generator, score 0.95'
  },
  {
    strategy: 'relativePriority',
    strategyName: 'Draft Priorities',
    action: 'boosted',
    score: 0.99,
    reason: 'High-priority tags: letter-s (priority 0.95 → boost 1.04x → 0.99)'
  }
]
```

## Score Semantics

| Score | Meaning |
|-------|---------|
| 1.0 | Fully suitable |
| 0.5 | Neutral |
| 0.0 | Exclude (hard filter) |
| 0.x | Proportional suitability |

**Filters are multiplicative** - order doesn't matter for final score.

## Why No Reviews? (Diagnostic Checklist)

When a session shows 0 reviews despite expecting some:

1. **SRS Generator query**: Did `getPendingReviews(courseId)` return any?
   - Check: `[DB:INFO] Fetching Alice's scheduled reviews for course X`
   - If none returned, no reviews are scheduled for this user/course

2. **Due filter**: Are any reviews actually due now?
   - SRSNavigator filters: `now.isAfter(moment.utc(r.reviewTime))`
   - Reviews scheduled in the future are excluded

3. **Score competition**: Did reviews score lower than new cards?
   - SRS urgency scores typically range 0.5-0.95
   - ELO new card scores can hit 1.0 for perfectly matched cards
   - Higher scores win the final selection

4. **Limit constraints**: Did the limit cut off reviews?
   - If 20 new cards score 0.99 and reviews score 0.60, reviews may not make the cut

5. **Filter attrition**: Did a filter zero-out reviews?
   - Check filter provenance for `action: 'penalized'` with `score: 0`

## Current Logging Points

| Log Prefix | Level | Content |
|------------|-------|---------|
| `[Pipeline] Configuration:` | INFO | Generator name, filter list |
| `[Pipeline] Execution:` | INFO | Counts: generated → filtered → final |
| `[Pipeline] Provenance for top N cards:` | DEBUG | Full provenance trail |
| `[CompositeGenerator]` | DEBUG | Generator creation |
| `[srsNav]` | DEBUG | Weighted cards count |
| `LOG-SessionController@...` | LOG | Final card selection list |

**Note:** DEBUG level only appears in development builds (`NODE_ENV=development`).