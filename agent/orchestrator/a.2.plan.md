# Plan: Scorable NavigationStrategy Architecture

## Context

This plan implements a scorable strategy architecture for content navigation, driven primarily by the LettersPractice (LP) use case but designed for content-agnostic reuse.

**Source-verified** against:
- `packages/db/src/core/navigators/index.ts` — `ContentNavigator` abstract class
- `packages/db/src/core/navigators/elo.ts` — `ELONavigator` implementation
- `packages/db/src/study/SessionController.ts` — Queue management
- `packages/db/src/core/types/contentNavigationStrategy.ts` — `ContentNavigationStrategyData` schema
- `packages/db/src/core/interfaces/userDB.ts` — `UserDBInterface` with history access

**Primary goals**:
1. Enforce "single new concept at a time" via prerequisite/mastery gating (HierarchyDefinition)
2. Separate confusable concepts (InterferenceMitigator)
3. Design strategies as evolutionary-ready: return suitability scores (0-1), composable by weight

**Non-goals for MVP**:
- Full orchestrator implementation (LP can ship with HierarchyDefinition alone)
- Classroom filtering integration
- Debug/visualization UI
- Multi-arm bandit experimentation framework (architecture should support it, not implement it)

---

## Architecture Overview

### Core Change: Strategies Return Weighted Cards

**Current interface** (legacy):
```
ContentNavigator (current)
├── getNewCards(n?: number): Promise<StudySessionNewItem[]>
└── getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>
```

**Proposed interface**:
```
ContentNavigator (proposed)
├── getWeightedCards(limit: number): Promise<WeightedCard[]>  // NEW: primary method
├── getNewCards(n?: number): Promise<StudySessionNewItem[]>   // DEPRECATED: compat
└── getPendingReviews(): Promise<...>                         // DEPRECATED: compat
```

**New types**:
```typescript
interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;           // 0-1 suitability
  source: 'new' | 'review' | 'failed';
}
```

**Scoring semantics**:
- `1.0` = fully suitable, present freely
- `0.0` = unsuitable, hard filter (e.g., prerequisite not met)
- `0.5` = neutral / no opinion
- Intermediate values = soft preference (e.g., 0.8 = good but not ideal timing)

**Key insight**: Some strategies *generate* candidates (ELO, SRS), others *filter/score* candidates (Hierarchy, Interference). The delegate pattern handles this:
- **Generator strategies**: ELO, SRS — produce candidates with scores
- **Filter strategies**: Hierarchy, Interference — wrap a delegate, transform its output

### Strategy Composition Model: Delegate Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    Future Orchestrator                       │
│  (weighted combination, evolutionary selection, A/B tests)   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │ InterferenceMitigator         │
              │ (filter: reduces scores for   │
              │  tag overlap with recent)     │
              └───────────────┬───────────────┘
                              │ delegates to
                              ▼
              ┌───────────────────────────────┐
              │ HierarchyDefinition           │
              │ (filter: gates by prereqs,    │
              │  score=0 or passthrough)      │
              └───────────────┬───────────────┘
                              │ delegates to
                              ▼
              ┌───────────────────────────────┐
              │ ELONavigator                  │
              │ (generator: produces cards    │
              │  near user skill level)       │
              └───────────────────────────────┘
```

**Generator strategies** (produce candidates):
- **ELO**: Cards near user skill, scored by ELO distance
- **SRS**: Overdue reviews, scored by overdueness

**Filter strategies** (wrap a delegate):
- **Hierarchy**: Gates by prerequisites — score=0 (locked) or delegate's score (unlocked)
- **Interference**: Reduces scores for cards with tags similar to recent history

For MVP: LP uses HierarchyDefinition(delegate=ELO) directly. Future: stack Interference on top.

### Strategy Data Access Pattern

Each strategy receives `user: UserDBInterface` and `course: CourseDBInterface` in its constructor. This provides:

**From UserDBInterface**:
- `getSeenCards(courseId)` — cards user has encountered
- `getActiveCards()` — cards currently scheduled  
- `getPendingReviews(courseId)` — scheduled reviews with timestamps
- `getCourseRegDoc(courseId)` — course registration including per-tag ELO
- `putCardRecord()` — card interaction history

**From CourseDBInterface**:
- `getAppliedTags(cardId)` — tags on a card
- `getCardEloData(cardIds)` — card difficulty ratings
- `getCourseTagStubs()` — all tags in course

**Strategy-specific storage**: Strategies can store their own data (e.g., interference events, session history) in userDB via the `DocumentUpdater` interface. Pattern: `{strategyType}-{strategyId}-{dataType}` document IDs. This supports multiple instances of the same strategy type (e.g., competing hierarchies, micro-hierarchies that cooperate).

---

## Implementation Phases

### Phase 1: WeightedCard Interface + ELO Implementation

**Goal**: Add `getWeightedCards()` to ContentNavigator, implement in ELO, maintain backward compat.

**Files to modify**:
- `packages/db/src/core/navigators/index.ts` — Add interface, types, default impl
- `packages/db/src/core/navigators/elo.ts` — Implement weighted cards with ELO scoring

**New types** (add to navigators/index.ts or separate types file):
```typescript
export interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;           // 0-1 suitability
  source: 'new' | 'review' | 'failed';
}
```

**Interface change**:
```typescript
// packages/db/src/core/navigators/index.ts

export abstract class ContentNavigator implements StudyContentSource {
  // Existing factory method unchanged
  static async create(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ): Promise<ContentNavigator> { /* ... */ }

  // NEW: Primary method for getting scored cards
  /**
   * Get cards with suitability scores.
   * 
   * @param limit - Maximum cards to return
   * @returns Cards sorted by score descending
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // Default: delegate to legacy methods, assign score=1.0
    const newCards = await this.getNewCards(limit);
    const reviews = await this.getPendingReviews();
    
    const weighted: WeightedCard[] = [
      ...newCards.map(c => ({ 
        cardId: c.cardID, 
        courseId: c.courseID, 
        score: 1.0, 
        source: 'new' as const 
      })),
      ...reviews.map(r => ({ 
        cardId: r.cardID, 
        courseId: r.courseID, 
        score: 1.0, 
        source: 'review' as const 
      })),
    ];
    
    return weighted.slice(0, limit);
  }

  // DEPRECATED: Legacy methods maintained for backward compat
  abstract getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;
  abstract getNewCards(n?: number): Promise<StudySessionNewItem[]>;
}
```

**ELO implementation** (scoring by ELO distance):
```typescript
// packages/db/src/core/navigators/elo.ts

async getWeightedCards(limit: number): Promise<WeightedCard[]> {
  // Get user's ELO for this course
  const courseReg = await this.user.getCourseRegDoc(this.course.getCourseID());
  const userElo = courseReg?.elo?.global?.score ?? 1000;
  
  // Get new cards (existing logic)
  const newCards = await this.getNewCards(limit);
  
  // Get reviews (existing logic)  
  const reviews = await this.getPendingReviews();
  
  // Score new cards by ELO distance
  const scoredNew = await Promise.all(newCards.map(async (c) => {
    const [cardEloData] = await this.course.getCardEloData([c.cardID]);
    const cardElo = cardEloData?.global?.score ?? 1000;
    const distance = Math.abs(cardElo - userElo);
    const score = Math.max(0, 1 - distance / 500);
    
    return {
      cardId: c.cardID,
      courseId: c.courseID,
      score,
      source: 'new' as const,
    };
  }));
  
  // Score reviews by overdueness (placeholder: 1.0 for now)
  const scoredReviews = reviews.map(r => ({
    cardId: r.cardID,
    courseId: r.courseID,
    score: 1.0,  // TODO: score by overdueness
    source: 'review' as const,
  }));
  
  // Combine and sort by score
  const all = [...scoredNew, ...scoredReviews];
  all.sort((a, b) => b.score - a.score);
  
  return all.slice(0, limit);
}
```

**Success criteria**:
- [ ] `WeightedCard` type defined
- [ ] `getWeightedCards()` exists on ContentNavigator with default implementation
- [ ] ELONavigator implements `getWeightedCards()` with ELO-distance scoring
- [ ] Existing `getNewCards()` / `getPendingReviews()` still work (backward compat)
- [ ] New unit tests for `getWeightedCards()` behavior

**Estimated effort**: 3-4 hours

---

### Phase 2: HierarchyDefinition Strategy (Filter/Delegate Pattern)

**Goal**: Implement prerequisite-gated card selection using delegate pattern.

**New file**: `packages/db/src/core/navigators/hierarchyDefinition.ts`

**Configuration schema** (stored in `serializedData`):
```typescript
interface HierarchyConfig {
  prerequisites: {
    [tagId: string]: {
      requires: string[];           // Tags that must be mastered first
      masteryThreshold?: {
        minElo?: number;            // Default: compare to course avg for tag
        minCount?: number;          // Default: 3 (minimum interactions)
      };
    };
  };
  delegateStrategy?: string;        // Strategy to wrap (default: "elo")
}
```

**Example LP configuration**:
```json
{
  "prerequisites": {
    "letter-b": {
      "requires": ["letter-s", "letter-a", "letter-t"],
      "masteryThreshold": { "minCount": 5 }
    },
    "letter-d": {
      "requires": ["letter-b"],
      "masteryThreshold": { "minCount": 5 }
    },
    "cvc-words": {
      "requires": ["letter-s", "letter-a", "letter-t", "letter-m"],
      "masteryThreshold": { "minCount": 3 }
    }
  },
  "delegateStrategy": "elo"
}
```

**Delegate pattern implementation**:
```typescript
class HierarchyDefinitionNavigator extends ContentNavigator {
  private delegate: ContentNavigator;
  private config: HierarchyConfig;
  
  constructor(user, course, strategyData) {
    super();
    this.config = JSON.parse(strategyData.serializedData);
    // Delegate created in async init or lazily
  }
  
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // 1. Get candidates from delegate
    const candidates = await this.delegate.getWeightedCards(limit * 2);
    
    // 2. Get user's mastery state
    const masteredTags = await this.getMasteredTags();
    const unlockedTags = this.getUnlockedTags(masteredTags);
    
    // 3. Filter/gate candidates
    const gated: WeightedCard[] = [];
    for (const card of candidates) {
      const cardTags = await this.course.getAppliedTags(card.cardId);
      const isUnlocked = cardTags.every(tag => 
        unlockedTags.has(tag) || !this.hasPrerequisites(tag)
      );
      
      if (isUnlocked) {
        gated.push(card);  // Preserve delegate's score
      }
      // else: score=0, filtered out
      
      if (gated.length >= limit) break;
    }
    
    return gated;
  }
  
  // Legacy methods delegate through
  async getNewCards(n) { return this.delegate.getNewCards(n); }
  async getPendingReviews() { return this.delegate.getPendingReviews(); }
}
```

**Key methods**:
- `getMasteredTags(): Promise<Set<string>>` — tags where user ELO > threshold
- `getUnlockedTags(mastered): Set<string>` — tags whose prerequisites are all mastered
- `hasPrerequisites(tag): boolean` — check if tag is in config

**Mastery detection**:
- Get user's per-tag ELO from `user.getCourseRegDoc(courseId).elo.tags`
- Compare `userElo(tag) > avgElo(tag)` (or configured threshold)
- Also check interaction count meets minimum

**Success criteria**:
- [ ] HierarchyDefinitionNavigator implemented with delegate pattern
- [ ] Configuration parsed from `serializedData`
- [ ] Delegate navigator created (defaults to ELO)
- [ ] Per-tag ELO correctly read from user's CourseElo
- [ ] Mastery detection works (ELO threshold + count)
- [ ] Locked cards filtered (score=0), unlocked cards preserve delegate score
- [ ] Unit tests for mastery detection, unlocking, filtering
- [ ] Integration test: user progresses through prerequisite chain

**Estimated effort**: 4-6 hours

---

### Phase 3: InterferenceMitigator Strategy (Filter/Delegate Pattern)

**Goal**: Avoid introducing confusable concepts while either is immature. Course authors define explicit interference relationships.

**New file**: `packages/db/src/core/navigators/interferenceMitigator.ts`

**Configuration schema**:
```typescript
interface InterferenceConfig {
  /** Groups of tags that interfere with each other */
  interferenceSets: string[][];  // e.g., [["b", "d", "p"], ["d", "t"]]
  
  /** Threshold below which a tag is considered "immature" */
  maturityThreshold?: {
    minCount?: number;   // default: 10
    minElo?: number;     // optional
  };
  
  /** How much to reduce score for interfering cards (default: 0.8) */
  interferenceDecay?: number;
  
  delegateStrategy?: string;    // Strategy to wrap (default: "elo")
}
```

**Example LP configuration**:
```json
{
  "interferenceSets": [
    ["b", "d", "p"],
    ["d", "t"],
    ["m", "n"]
  ],
  "maturityThreshold": { "minCount": 10 },
  "interferenceDecay": 0.8
}
```

**Algorithm**:
1. Build interference map from config (tag → set of interfering tags)
2. Identify user's **immature tags** (started but below maturity threshold)
3. Compute **tags to avoid** = partners of immature tags (excluding already-immature ones)
4. For each candidate card, reduce score if its tags overlap with avoid set

```typescript
class InterferenceMitigatorNavigator extends ContentNavigator {
  private interferenceMap: Map<string, Set<string>>;  // Precomputed from config
  
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    const candidates = await this.delegate.getWeightedCards(limit * 3);
    
    // Identify what to avoid
    const immatureTags = await this.getImmatureTags();
    const tagsToAvoid = this.getTagsToAvoid(immatureTags);
    
    // Adjust scores
    const adjusted = candidates.map(card => {
      const cardTags = await this.getCardTags(card.cardId);
      const multiplier = this.computeInterferenceMultiplier(cardTags, tagsToAvoid);
      return { ...card, score: card.score * multiplier };
    });
    
    adjusted.sort((a, b) => b.score - a.score);
    return adjusted.slice(0, limit);
  }
  
  private async getImmatureTags(): Promise<Set<string>> {
    // Tags where user has count > 0 but below maturity threshold
    const userElo = await this.user.getCourseRegDoc(...).elo.tags;
    // Return tags that are started but not yet mature
  }
  
  private getTagsToAvoid(immatureTags: Set<string>): Set<string> {
    // For each immature tag, add its interference partners
    // (but not if partner is also immature — already learning both)
  }
  
  private computeInterferenceMultiplier(cardTags: string[], avoid: Set<string>): number {
    const interferingCount = cardTags.filter(t => avoid.has(t)).length;
    if (interferingCount === 0) return 1.0;
    return Math.pow(1.0 - decay, interferingCount);  // More interference = lower score
  }
}
```

**Key insight**: This is maturity-aware, not just recency-aware. The goal is to maximize conceptual distance when introducing new content while foundational concepts are still being learned.

**LP use case**: While learning `d`, prefer introducing `x` over `b` (visual similarity) or `t` (phonetic similarity). Once `d` is mature, `b` and `t` can be introduced freely.

**Future consideration**: Minimal-pair exercises (e.g., `bad` vs `dad`) for deliberate contrast when it IS time to introduce interfering concepts. May be a separate strategy or an extension.

**Success criteria**:
- [x] InterferenceMitigatorNavigator implemented with delegate pattern
- [x] Interference sets parsed from config, precomputed into map
- [x] Immature tag detection (started but below threshold)
- [x] Tags-to-avoid computation (partners of immature tags)
- [x] Score reduction based on interference overlap
- [x] Delegate's scores preserved and adjusted (multiplicative)

**Estimated effort**: 3-4 hours

---

### Phase 4: Orchestrator (Deferred)

**Note**: Not needed for LP MVP — delegate pattern handles composition. Documented for future.

**When needed**: For evolutionary experimentation (multi-arm bandit), A/B testing, or combining independent (non-nested) strategies.

**Key insight**: With delegate pattern, Hierarchy and Interference can be stacked:
```
Interference(delegate=Hierarchy(delegate=ELO))
```

This covers LP's needs. A full Orchestrator is for more complex cases:
- Multiple independent strategy "votes" combined by weight
- Dynamic strategy selection based on context
- Evolutionary utility tracking

**Future configuration sketch**:
```typescript
interface OrchestratorConfig {
  strategies: Array<{
    implementingClass: string;
    serializedData: string;
    weight: number;              // 0-1, relative importance
  }>;
  combineMode: 'multiply' | 'weighted-average' | 'min';
  fallbackStrategy?: string;
}
```

---

## Data Dependencies

### Per-Tag ELO (Already Exists)

**Location**: `CourseElo.tags` in user's course registration

**Current status**: Tracked but not used for card selection

**What we need**: Read access in HierarchyDefinition strategy via `user.getCourseRegDoc(courseId)`

```typescript
// From packages/db/src/core/types/user.ts
type CourseElo = {
  global: EloRank;
  tags: { [tagID: string]: EloRank };
};

type EloRank = {
  score: number;
  count: number;
};
```

### Session Context (For Interference)

**Current**: `SessionController` manages queues internally. Strategies access user history via `UserDBInterface`.

**Approach**: InterferenceMitigator queries `user.getSeenCards(courseId)`. Takes last N cards by document order.

**Note**: `getSeenCards()` returns card IDs only, no timestamps. For MVP, "last N cards" is sufficient. Future: query card records with timestamps for finer control.

### Delegate Strategy Creation

**Challenge**: Filter strategies need to instantiate their delegate navigator.

**Approach**: Use existing `ContentNavigator.create(user, course, strategyData)` factory:
```typescript
// In HierarchyDefinitionNavigator constructor or init
const delegateStrategyData = {
  implementingClass: this.config.delegateStrategy || 'elo',
  serializedData: '{}',
  // ... other required fields
};
this.delegate = await ContentNavigator.create(this.user, this.course, delegateStrategyData);
```

---

## File Changes Summary

| Phase | File | Change |
|-------|------|--------|
| 1 | `packages/db/src/core/navigators/index.ts` | Add `scoreCard()` abstract method with default |
| 1 | `packages/db/src/core/navigators/elo.ts` | Implement `scoreCard()` with ELO distance |
| 2 | `packages/db/src/core/navigators/hierarchyDefinition.ts` | New file |
| 2 | `packages/db/src/core/navigators/index.ts` | Register new navigator in factory |
| 3 | `packages/db/src/core/navigators/interferenceMitigator.ts` | New file |
| 3 | `packages/db/src/core/navigators/index.ts` | Register new navigator in factory |
| 3 | `packages/db/src/study/SessionController.ts` | Pass context to scoreCard (if Option B) |

---

## Testing Strategy

### Unit Tests

- `getWeightedCards()` default returns cards with score=1.0
- ELO scoring: distance 0 → 1.0, distance 500 → 0.0
- Hierarchy mastery detection: threshold logic
- Hierarchy unlocking: prerequisite chain traversal
- Hierarchy gating: locked cards filtered, unlocked preserve delegate score
- Interference similarity: Jaccard calculation
- Interference score adjustment: high similarity → reduced score (multiplicative)

### Integration Tests

- Hierarchy: New user sees only root-level content, progresses as mastery increases
- Interference: Similar cards get lower scores, appear later in sequence
- Delegate chain: `Interference(Hierarchy(ELO))` works correctly
- Backward compat: `getNewCards()` / `getPendingReviews()` still work

### Manual Testing (LP-specific)

- Fresh user sees `s`, `a`, `t` before `b` or `d`
- User who knows `s`, `a`, `t` unlocks CVC words
- Letters `b` and `d` get reduced scores when one was recently seen

---

## Success Metrics

**Development**:
- [ ] Phase 1-3 complete
- [ ] All unit tests passing
- [ ] No regression in existing navigator tests

**LP validation**:
- [ ] Prerequisite chain enforced in practice sessions
- [ ] Confusable letters separated
- [ ] Session feels coherent (not random-seeming)

**Future-readiness**:
- [ ] Strategies implement `scoreCard()` with meaningful values
- [ ] Orchestrator (Phase 4) can be added without modifying strategies
- [ ] Evolutionary layer can assign/remove strategies via configuration

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Per-tag ELO not populated for new users | Medium | Default to unlocked for tags with no data; hierarchy config can specify "root" tags |
| Over-filtering leaves no cards | Low (LP controls content) | Delegate chain ensures base ELO always provides candidates; Hierarchy gates but doesn't generate |
| Tag query performance | Low | Batch tag fetches; cache for session duration |
| Hierarchy graph cycles | Low (LP controls config) | Add cycle detection in Phase 2; error on save |
| Delegate creation fails | Low | Validate delegate strategy exists; fall back to ELO |

---

## Open Decisions

1. ~~**Context passing for Interference**~~: Resolved — strategies access user history directly via `UserDBInterface.getSeenCards()`.

2. ~~**Root tag handling**~~: Confirmed — tags with no prerequisites are always unlocked.

3. ~~**Mastery threshold defaults**~~: Mastery = `userElo(tag) > avgElo(tag)`. The hierarchy config can set specific per-tag targets.

4. ~~**Tag query batching**~~: Current `getAppliedTags(courseId, cardId)` is single-card. For MVP, acceptable.

5. ~~**Recency filtering for interference**~~: Use "last N cards" by document order. Timestamps available if needed later.

6. ~~**Interface shape**~~: Resolved — `getWeightedCards()` returns scored cards. Filter strategies use delegate pattern, adjusting delegate's scores.

---

## Next Steps

1. User approves plan
2. Create `a.3.todo.md` with checkboxed task breakdown
3. Begin Phase 1 implementation
