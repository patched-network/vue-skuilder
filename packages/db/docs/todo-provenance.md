# TODO: WeightedCard Provenance (Audit Trail)

## Status: DEFERRED

This is a future enhancement to replace the vestigial `source: 'new' | 'review' | 'failed'` field
with a proper audit trail that explains how each card was surfaced.

## Spirit

A primary goal of this framework is to make dynamic, rich, adaptive courseware that is also
**legible and transparent**. Surfaced content should contain an audit trail — it should be
knowable how the ContentNavigator(s) colluded together to surface it.

This matters for:
1. **Informed consent** ("free software, free society") — users should understand why they're 
   seeing what they're seeing
2. **Continual improvement** — if something not useful is surfaced, the pathways can be inspected
   and improved
3. **Debugging** — developers and course authors can trace scoring decisions

## The Problem

The current `WeightedCard.source` field:
```typescript
source: 'new' | 'review' | 'failed'
```

This is vestigial — it carries forward the old API's categorization (artifacts of hard-coded
ELO + SRS) rather than serving the new architecture's transparency goals.

## Proposed Solution: Provenance

Replace (or augment) `source` with a `provenance` array that records each strategy's contribution:

```typescript
interface StrategyContribution {
  /** Which strategy processed this card */
  strategy: string;  // e.g., 'elo', 'hierarchyDefinition'
  
  /** What the strategy did */
  action: 'generated' | 'passed' | 'filtered' | 'boosted' | 'penalized';
  
  /** Score after this strategy's processing */
  score: number;
  
  /** Human-readable explanation (optional) */
  reason?: string;
}

interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;
  provenance: StrategyContribution[];
}
```

### Example Provenance Trail

```typescript
provenance: [
  { strategy: 'elo', action: 'generated', score: 0.85, 
    reason: 'ELO distance 75, source: new' },
  { strategy: 'hierarchyDefinition', action: 'passed', score: 0.85, 
    reason: 'prereqs met: letter-sounds' },
  { strategy: 'interferenceMitigator', action: 'penalized', score: 0.68, 
    reason: 'interferes with immature tag "d" (decay 0.8)' },
  { strategy: 'relativePriority', action: 'boosted', score: 0.78, 
    reason: 'high-priority tag "s" (0.95) → boost 1.15' }
]
```

## Implementation Sketch

### Generator Strategies

Create initial provenance when generating candidates:

```typescript
// In ELONavigator.getWeightedCards()
const card: WeightedCard = {
  cardId: c.id,
  courseId: this.courseId,
  score: eloScore,
  provenance: [{
    strategy: 'elo',
    action: 'generated',
    score: eloScore,
    reason: `ELO distance ${distance}${isReview ? ', due for review' : ', new card'}`
  }]
};
```

### Filter Strategies

Append to existing provenance:

```typescript
// In RelativePriorityNavigator.getWeightedCards()
return candidates.map(card => ({
  ...card,
  score: adjustedScore,
  provenance: [...card.provenance, {
    strategy: 'relativePriority',
    action: adjustedScore > card.score ? 'boosted' : 
            adjustedScore < card.score ? 'penalized' : 'passed',
    score: adjustedScore,
    reason: `priority ${priority.toFixed(2)} → factor ${boostFactor.toFixed(2)}`
  }]
}));
```

## Migration Path

1. **Phase A**: Add `provenance` as optional field
   - New strategies populate it
   - Legacy code ignores it
   - Tests verify provenance structure

2. **Phase B**: SessionController uses provenance
   - Derive new/review/failed from `provenance[0].reason` or add explicit metadata
   - Display provenance in debug UI

3. **Phase C**: Deprecate `source` field
   - Remove once all consumers use provenance

## Backward Compatibility

The `source` field may still be needed temporarily for SessionController queue routing.
Options:
- Keep both fields during transition
- Derive `source` from `provenance[0]` (generator knows if it's review/new)
- Add a lightweight `origin: 'new' | 'review' | 'failed'` that's purely for routing

## Open Questions

1. Should `provenance` be required or optional?
2. Should we keep `source` for queue routing, or derive from provenance?
3. What's the right `action` vocabulary? Proposed: `generated | passed | filtered | boosted | penalized`
4. Should `reason` be structured (for machine parsing) or freeform (for human reading)?
5. Performance: is copying/extending arrays on each strategy pass acceptable?

## Related

- `packages/db/src/core/navigators/ARCHITECTURE.md` — API migration guide
- `packages/db/src/core/navigators/index.ts` — WeightedCard definition
- `agent/orchestrator/a.2.plan.md` — overall navigation strategy plan
