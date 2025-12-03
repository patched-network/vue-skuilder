# Plan: WeightedCard Provenance Implementation (Big Bang)

## Overview

Replacing the vestigial `source` field in `WeightedCard` with a comprehensive `provenance` array that tracks each strategy's contribution to card scoring. This is a breaking change implemented in a single PR.

## Design Decisions

### 1. StrategyContribution Interface

```typescript
interface StrategyContribution {
  /** Which strategy processed this card */
  strategy: string;  // e.g., 'elo', 'hierarchyDefinition'

  /** What the strategy did */
  action: 'generated' | 'passed' | 'boosted' | 'penalized';

  /** Score after this strategy's processing */
  score: number;

  /** Human-readable explanation (REQUIRED for legibility) */
  reason: string;
}
```

**Key decisions:**
- `reason` is **required** - legibility is the goal, silent adjusters are anti-patterns
- `action` vocabulary:
  - `generated` - Strategy produced this card
  - `passed` - Strategy evaluated but didn't change score (unchanged/transparent)
  - `boosted` - Strategy increased score
  - `penalized` - Strategy decreased score

### 2. Updated WeightedCard Interface

```typescript
interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;
  provenance: StrategyContribution[];  // REQUIRED, no more 'source' field
}
```

**Removed:** `source: 'new' | 'review' | 'failed'`

### 3. Deriving Origin from Provenance

The first entry in provenance (from the generator) determines origin:

```typescript
function getCardOrigin(card: WeightedCard): 'new' | 'review' | 'failed' {
  if (card.provenance.length === 0) {
    throw new Error('Card has no provenance');
  }

  const firstEntry = card.provenance[0];
  // Extract from reason string or add explicit metadata
  // Option A: Parse reason string (fragile)
  // Option B: Add optional 'metadata' field to StrategyContribution
  // Option C: Generators set explicit origin in a known format

  // Recommendation: Extract from reason or use convention
  // E.g., ELO reason: "ELO distance 75, new card" vs "ELO distance 75, review"
}
```

**Alternative:** Add optional `metadata` field to `StrategyContribution` for structured data:

```typescript
interface StrategyContribution {
  strategy: string;
  action: 'generated' | 'passed' | 'boosted' | 'penalized';
  score: number;
  reason: string;
  metadata?: Record<string, any>;  // e.g., { origin: 'new', eloDistance: 75 }
}
```

**Decision needed:** Should we add metadata field for structured info, or derive from reason strings?

## Implementation Steps

### Step 1: Update Core Types (packages/db/src/core/navigators/index.ts)

1. Add `StrategyContribution` interface
2. Update `WeightedCard` interface - remove `source`, add required `provenance`
3. Add helper function `getCardOrigin(card: WeightedCard)` for extracting origin
4. Update JSDoc comments

### Step 2: Update Generator Navigators

Each generator creates initial provenance entry:

#### ELONavigator (elo.ts)
```typescript
async getWeightedCards(limit: number): Promise<WeightedCard[]> {
  // ... existing logic ...

  return weighted.map(({ cardId, courseId, score, isReview }) => ({
    cardId,
    courseId,
    score,
    provenance: [{
      strategy: 'elo',
      action: 'generated',
      score,
      reason: `ELO distance ${distance}, ${isReview ? 'review' : 'new card'}`
    }]
  }));
}
```

**Files to modify:**
- `packages/db/src/core/navigators/elo.ts`
- `packages/db/src/core/navigators/hardcodedOrder.ts` (if exists)
- Any SRS navigator (if exists)

#### CompositeGenerator (CompositeGenerator.ts)
- Each sub-generator adds its own provenance
- CompositeGenerator adds final entry about frequency boost/merging

```typescript
// After merging candidates from multiple generators
const withCompositeProvenance = merged.map(card => ({
  ...card,
  provenance: [
    ...card.provenance,
    {
      strategy: 'composite',
      action: card.wasBoosted ? 'boosted' : 'passed',
      score: card.score,
      reason: card.wasBoosted
        ? `Frequency boost ${boostFactor.toFixed(2)}x (appeared in ${count} generators)`
        : `No boost needed (appeared in 1 generator)`
    }
  ]
}));
```

### Step 3: Update Filter Navigators

Each filter appends to existing provenance:

#### Pattern
```typescript
async getWeightedCards(limit: number): Promise<WeightedCard[]> {
  const delegate = await this.getDelegate();
  const candidates = await delegate.getWeightedCards(limit * multiplier);

  return candidates
    .map(card => {
      const adjustedScore = this.computeScore(card);
      const action = adjustedScore > card.score ? 'boosted'
                   : adjustedScore < card.score ? 'penalized'
                   : 'passed';

      return {
        ...card,
        score: adjustedScore,
        provenance: [
          ...card.provenance,
          {
            strategy: 'filterName',
            action,
            score: adjustedScore,
            reason: this.explainAdjustment(card, adjustedScore)
          }
        ]
      };
    })
    .filter(card => card.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
```

**Files to modify:**
- `packages/db/src/core/navigators/hierarchyDefinition.ts`
  - Reason example: "Prerequisites met: letter-sounds" vs "Blocked: missing prerequisite letter-sounds"

- `packages/db/src/core/navigators/interferenceMitigator.ts`
  - Reason example: "Interferes with immature tag 'd' (decay 0.8)" or "No interference detected"

- `packages/db/src/core/navigators/relativePriority.ts`
  - Reason example: "High-priority tag 's' (0.95) → boost 1.15x" or "Neutral priority (0.50)"

### Step 4: Update SessionController Queue Routing

**Current code (SessionController.ts ~line 186):**
```typescript
// Uses card.source to route to queues
```

**Updated code:**
```typescript
private getCardOrigin(card: WeightedCard): 'new' | 'review' | 'failed' {
  // Extract from first provenance entry
  const reason = card.provenance[0]?.reason || '';

  if (reason.includes('review')) return 'review';
  if (reason.includes('failed')) return 'failed';
  return 'new';
}

// Use in queue routing:
const origin = this.getCardOrigin(weightedCard);
if (origin === 'review') {
  this.reviewQ.enqueue(item);
} else if (origin === 'new') {
  this.newQ.enqueue(item);
} else {
  this.failedQ.enqueue(item);
}
```

**Alternative with metadata:**
```typescript
private getCardOrigin(card: WeightedCard): 'new' | 'review' | 'failed' {
  return card.provenance[0]?.metadata?.origin || 'new';
}
```

**Files to modify:**
- `packages/db/src/study/SessionController.ts`
  - Add `getCardOrigin()` helper
  - Update queue routing logic in `getWeightedContent()`

### Step 5: Update Consumer Code

**Files that may consume WeightedCard:**
- `packages/db/src/impl/couch/courseDB.ts` - `getWeightedCards()` implementation
- `packages/db/src/impl/couch/classroomDB.ts` - `getWeightedCards()` wrapper
- Any other code that references `WeightedCard.source`

**Search for usages:**
```bash
grep -r "\.source" packages/db/src --include="*.ts" | grep -i weighted
```

### Step 6: Update Tests

#### Update existing tests (packages/db/tests/core/navigators/navigators.test.ts)
- Remove assertions on `.source` field
- Add assertions on `.provenance` structure
- Verify provenance array length and contents

#### Add new provenance-specific tests
```typescript
describe('Provenance tracking', () => {
  it('generator creates initial provenance entry', async () => {
    const cards = await eloNav.getWeightedCards(10);
    expect(cards[0].provenance).toHaveLength(1);
    expect(cards[0].provenance[0]).toMatchObject({
      strategy: 'elo',
      action: 'generated',
      score: expect.any(Number),
      reason: expect.any(String)
    });
  });

  it('filters append to provenance', async () => {
    const cards = await hierarchyNav.getWeightedCards(10);
    expect(cards[0].provenance.length).toBeGreaterThan(1);
    expect(cards[0].provenance[0].strategy).toBe('elo'); // delegate
    expect(cards[0].provenance[1].strategy).toBe('hierarchyDefinition');
  });

  it('provenance tracks score changes', async () => {
    const cards = await priorityNav.getWeightedCards(10);
    const prov = cards[0].provenance;
    // Score should evolve through pipeline
    expect(prov[prov.length - 1].score).toBe(cards[0].score);
  });

  it('reason field is always populated', async () => {
    const cards = await eloNav.getWeightedCards(10);
    cards.forEach(card => {
      card.provenance.forEach(entry => {
        expect(entry.reason).toBeTruthy();
        expect(entry.reason.length).toBeGreaterThan(0);
      });
    });
  });
});
```

**Files to modify:**
- `packages/db/tests/core/navigators/navigators.test.ts`
- `packages/db/tests/core/navigators/CompositeGenerator.test.ts`

### Step 7: Update Documentation

#### navigators-architecture.md
- Update WeightedCard interface example
- Add provenance example showing full pipeline trail
- Update "Score Semantics" section to mention provenance
- Add "Provenance Tracking" section explaining the system

#### Delete todo-provenance.md
- Mark as IMPLEMENTED in commit message
- Delete file (goal achieved)

**Files to modify:**
- `packages/db/docs/navigators-architecture.md`
- `packages/db/docs/todo-provenance.md` (DELETE)

## Breaking Changes

### For Navigator Implementers
- Must return `provenance` array instead of `source` field
- Must provide `reason` for each provenance entry (required field)

### For Consumers
- `WeightedCard.source` no longer exists
- Must use `getCardOrigin(card)` helper or inspect `card.provenance[0]`

## Migration Guide (for external consumers, if any)

```typescript
// Before:
const isNew = card.source === 'new';

// After:
const origin = card.provenance[0]?.reason.includes('new') ? 'new'
             : card.provenance[0]?.reason.includes('review') ? 'review'
             : 'failed';
const isNew = origin === 'new';

// Or use helper:
import { getCardOrigin } from '@vue-skuilder/db/core';
const isNew = getCardOrigin(card) === 'new';
```

## Open Question: Metadata vs String Parsing

**Should we add a `metadata` field to `StrategyContribution` for structured data?**

### Option A: String parsing (simpler)
- Generators include origin in reason string: "ELO distance 75, new card"
- Helper parses reason to extract origin
- Pros: Simple, no extra field
- Cons: Fragile, string parsing is brittle

### Option B: Metadata field (more robust)
- Add optional `metadata?: Record<string, any>` to `StrategyContribution`
- Generators set `metadata: { origin: 'new' }` explicitly
- Pros: Type-safe, extensible, no parsing
- Cons: Slightly more complex, extra field

**Recommendation:** Start with Option A (string parsing) for initial implementation. If we find we need more structured data, add metadata field in a follow-up.

## Success Criteria

- [ ] All tests pass
- [ ] TypeScript compilation succeeds with no errors
- [ ] All navigators populate provenance correctly
- [ ] SessionController routes cards correctly using provenance
- [ ] Example provenance trail can be inspected in debug UI
- [ ] Documentation updated
- [ ] todo-provenance.md deleted

## Estimated Changes

- **Core types**: ~50 lines
- **Generators** (3-4 files): ~20-30 lines each
- **Filters** (3 files): ~20-30 lines each
- **SessionController**: ~30 lines
- **Tests**: ~100-150 lines
- **Documentation**: ~50 lines modified

**Total**: ~400-500 lines changed across ~15 files
