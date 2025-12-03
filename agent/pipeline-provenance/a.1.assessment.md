# Assessment: Implementing WeightedCard Provenance

## Context

The `WeightedCard` interface currently has a vestigial `source` field (`'new' | 'review' | 'failed'`) that carries forward the old hard-coded ELO + SRS categorization. The goal is to replace or augment this with a proper audit trail (`provenance`) that explains how each card was surfaced through the navigation pipeline.

## Current State

### WeightedCard Interface (packages/db/src/core/navigators/index.ts:54-61)
```typescript
export interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;
  source: 'new' | 'review' | 'failed';
}
```

### Navigator Architecture
- **Generators** (ELO, Hardcoded, SRS): Produce candidate cards with initial scores
- **Filters** (Hierarchy, Interference, RelativePriority): Wrap delegates and transform scores
- **Pipeline Assembly**: Automatic via `PipelineAssembler` based on `NAVIGATION_STRATEGY` documents

### Current Implementations Found
1. **ELONavigator** (elo.ts) - Generates cards, scores by ELO distance
2. **RelativePriorityNavigator** (relativePriority.ts) - Filter that boosts/penalizes based on tag priorities
3. **HierarchyDefinitionNavigator** - Filter for prerequisite gating
4. **InterferenceMitigatorNavigator** - Filter for confusability avoidance
5. **CompositeGenerator** - Merges multiple generators

### SessionController Usage (SessionController.ts:183-203)
- Checks for `getWeightedCards()` support
- Routes cards to separate queues (new/review/failed) based on `source` field
- Includes debug info with `api.mode` to indicate which API path is active

## Problem Analysis

The `source` field is insufficient for transparency goals because:
1. **Opaque**: Doesn't explain *why* a card was surfaced
2. **Binary**: Only tracks origin, not the full transformation pipeline
3. **Not actionable**: Can't debug scoring decisions or improve strategies
4. **Doesn't serve users**: No informed consent about what drives their experience

## Proposed Solution

Add a `provenance` field to `WeightedCard` that tracks each strategy's contribution:

```typescript
interface StrategyContribution {
  strategy: string;           // e.g., 'elo', 'hierarchyDefinition'
  action: 'generated' | 'passed' | 'filtered' | 'boosted' | 'penalized';
  score: number;              // Score after this strategy's processing
  reason?: string;            // Human-readable explanation
}

interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;
  source: 'new' | 'review' | 'failed';  // Keep temporarily for backward compat
  provenance?: StrategyContribution[];   // New field (optional initially)
}
```

## Implementation Approaches

### Option A: Phased Migration (Recommended)

**Phase 1: Add Optional Provenance**
- Add `provenance?` as optional field to `WeightedCard`
- Update navigators to populate it (generators and filters)
- Keep `source` field for backward compatibility
- Add tests verifying provenance structure

**Phase 2: SessionController Integration**
- Display provenance in debug UI
- Optionally log provenance for analysis

**Phase 3: Deprecate `source` (Future)**
- Remove `source` field once it's no longer needed
- Make `provenance` required

**Pros:**
- Low risk - doesn't break existing code
- Can roll out incrementally
- Easy to revert if issues arise
- Matches the documented migration pattern in todo-provenance.md

**Cons:**
- Longer timeline
- Temporary duplication (`source` + `provenance`)

### Option B: Big Bang Replacement
>>> let's go this way.

Replace `source` with `provenance` in one go.

**Pros:**
- Clean, no technical debt
- Simpler final state

**Cons:**
- High risk - breaks existing code that depends on `source`
- SessionController queue routing needs immediate rework
- Harder to test incrementally
- Could break if we miss a consumer

### Option C: Parallel Fields (Keep Both Permanently)

Keep both `source` (for routing) and `provenance` (for transparency).

**Pros:**
- `source` is lightweight for routing logic
- `provenance` serves different purpose (audit trail)
- No breaking changes

**Cons:**
- Slight duplication
- Need to keep `source` and `provenance[0]` in sync

## Scope Considerations

### What's In Scope
1. Update `WeightedCard` interface
2. Update all navigator implementations (5 navigators + CompositeGenerator)
3. Add provenance to generator strategies (initial contribution)
4. Add provenance to filter strategies (append to array)
5. Add/update tests
6. Update architecture documentation

### What's Out of Scope (For Now)
1. UI changes to display provenance (separate task)
2. Provenance analytics/logging (separate task)
3. Removing `source` field (Phase 3, future)

## Key Files to Modify

### Core Interfaces
- `packages/db/src/core/navigators/index.ts` - Add types, update interface

### Generator Implementations
- `packages/db/src/core/navigators/elo.ts`
- `packages/db/src/core/navigators/CompositeGenerator.ts`
- Any SRS navigator (if exists)
- Any hardcoded navigator (if exists)

### Filter Implementations
- `packages/db/src/core/navigators/hierarchyDefinition.ts`
- `packages/db/src/core/navigators/interferenceMitigator.ts`
- `packages/db/src/core/navigators/relativePriority.ts`

### Tests
- `packages/db/tests/core/navigators/navigators.test.ts`
- `packages/db/tests/core/navigators/CompositeGenerator.test.ts`

### Documentation
- `packages/db/docs/navigators-architecture.md`
- `packages/db/docs/todo-provenance.md` (mark as IMPLEMENTED)
>>> goal will be to delete this doc

## Risks & Mitigations

### Risk 1: Performance Impact
**Concern**: Creating/copying provenance arrays on each strategy pass could be expensive.

**Mitigation**:
- Provenance arrays are typically small (3-5 entries)
- Spreading/appending is O(n) but n is tiny
- Can profile if needed, but unlikely to be an issue

### Risk 2: Breaking Changes
**Concern**: Existing code might not handle optional `provenance` field.

**Mitigation**:
- Make field optional initially
- TypeScript will catch any type mismatches
- Existing code can ignore the field

### Risk 3: Inconsistent Provenance
**Concern**: Navigators might populate provenance inconsistently.

**Mitigation**:
- Clear guidelines for what `action` values mean
- Tests that verify provenance structure
- Code review

### Risk 4: Sync Between `source` and `provenance`
**Concern**: `source` field might not match `provenance[0]` origin.

**Mitigation**:
- Derive `source` from generator's knowledge (new vs review)
- Document the relationship
- Could add helper function to extract source from provenance

## Open Questions

1. **Should `reason` be required or optional?**
   - Recommendation: Optional. Some strategies might not have meaningful reasons.
   >>> dubious that many would have no way to articulate some reason? legibility is the goal here. a silent adjuster is an anti-pattern. make required but 

2. **Should `provenance` be required or optional initially?**
   - Recommendation: Optional (Phase 1), then required (Phase 3).
   >>> we're doing all of this in one PR, so ... required from the start?

3. **What's the right action vocabulary?**
   - Proposed: `generated | passed | filtered | boosted | penalized`
   - Seems comprehensive for current strategies
   

4. **Should filters that don't change score still add provenance?**
   - Recommendation: Yes, with `action: 'passed'`. Shows the card went through that filter.
   >>> something that more specifically indicates 'no modification'. but yes - good to show I think.

5. **How to handle CompositeGenerator provenance?**
   - Each sub-generator adds its own provenance entry
   - CompositeGenerator might add a final entry about merging/boosting
   >>> these answers look good

## Recommendation

**Proceed with Option A: Phased Migration**

Start with Phase 1:
1. Add `provenance?` as optional field to `WeightedCard`
2. Update all navigators to populate provenance
3. Add comprehensive tests
4. Update documentation

This approach:
- Minimizes risk
- Allows incremental validation
- Matches the spirit of the existing migration pattern (legacy methods coexisting with new API)
- Can be completed in focused chunks

**Next Steps**: Create detailed plan for Phase 1 implementation.
