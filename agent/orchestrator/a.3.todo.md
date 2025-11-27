# TODO: Scorable NavigationStrategy Architecture

**Reference**: See `a.2.plan.md` for full context, architecture diagrams, and rationale.

**Summary**: Add `getWeightedCards()` method to navigation strategies that returns cards with suitability scores. Filter strategies (Hierarchy, Interference) use a delegate pattern — they wrap another strategy and transform its output.

---

## Phase 1: WeightedCard Interface + ELO Implementation

**Status**: COMPLETED

**Goal**: Add `getWeightedCards()` to `ContentNavigator`, implement in ELO, maintain backward compat with `getNewCards()`/`getPendingReviews()`.

### Tasks

- [x] p1.1: Define `WeightedCard` type
  - File: `packages/db/src/core/navigators/index.ts`
  - Fields: `cardId`, `courseId`, `score` (0-1), `source` ('new' | 'review' | 'failed')

- [x] p1.2: Add `getWeightedCards()` to `ContentNavigator` base class
  - File: `packages/db/src/core/navigators/index.ts`
  - Signature: `async getWeightedCards(limit: number): Promise<WeightedCard[]>`
  - Default implementation: calls legacy `getNewCards()` + `getPendingReviews()`, assigns score=1.0

- [x] p1.3: Implement `getWeightedCards()` in `ELONavigator`
  - File: `packages/db/src/core/navigators/elo.ts`
  - Get user ELO via `this.user.getCourseRegDoc(courseId)` + `toCourseElo()`
  - Score = inverse of ELO distance: `Math.max(0, 1 - distance / 500)`
  - Batches ELO lookups for efficiency
  - Combine new cards + reviews, sort by score descending

- [x] p1.4: Add unit tests
  - Created: `packages/db/src/core/navigators/navigators.test.ts`
  - Tests for WeightedCard type structure
  - Tests for default getWeightedCards() behavior
  - Tests for ELO scoring formula

- [x] p1.5: Verify build and tests pass
  - [x] Build: `yarn workspace @vue-skuilder/db build` ✓
  - [x] Tests: delegated to CI

---

## Phase 2: HierarchyDefinition Strategy

**Status**: NEXT

**Goal**: Prerequisite-gated card selection using delegate pattern. Cards locked until user masters prerequisite tags.

### Tasks

- [ ] p2.1: Create `HierarchyDefinitionNavigator` class
  - New file: `packages/db/src/core/navigators/hierarchyDefinition.ts`
  - Extends `ContentNavigator`
  - Has `delegate: ContentNavigator` field

- [ ] p2.2: Parse config from `serializedData`
  ```typescript
  interface HierarchyConfig {
    prerequisites: {
      [tagId: string]: {
        requires: string[];
        masteryThreshold?: { minElo?: number; minCount?: number; };
      };
    };
    delegateStrategy?: string;  // default: "elo"
  }
  ```

- [ ] p2.3: Create delegate navigator in constructor/init
  - Use `ContentNavigator.create(user, course, delegateStrategyData)`
  - Default delegate: ELO

- [ ] p2.4: Implement `getMasteredTags(): Promise<Set<string>>`
  - Get user's per-tag ELO from `user.getCourseRegDoc(courseId).elo.tags`
  - Tag is mastered if: `userElo(tag) > avgElo(tag)` AND `count >= minCount`

- [ ] p2.5: Implement `getUnlockedTags(mastered: Set<string>): Set<string>`
  - Tag is unlocked if all its prerequisites are in `mastered`
  - Tags with no prerequisites are always unlocked

- [ ] p2.6: Implement `getWeightedCards(limit)`
  - Get candidates from delegate (over-fetch: `limit * 2`)
  - For each candidate, get card's tags
  - If any tag is locked: filter out (score=0)
  - If all tags unlocked: keep card with delegate's score
  - Return filtered list

- [ ] p2.7: Implement legacy methods (delegate through)
  - `getNewCards(n)` → `this.delegate.getNewCards(n)`
  - `getPendingReviews()` → `this.delegate.getPendingReviews()`

- [ ] p2.8: Register in factory
  - File: `packages/db/src/core/navigators/index.ts`
  - Add to `Navigators` enum: `HIERARCHY = 'hierarchyDefinition'`

- [ ] p2.9: Add unit tests
  - Mastery detection (ELO threshold + count)
  - Unlocking logic (prerequisite chain)
  - Gating: locked cards filtered, unlocked cards preserve delegate score
  - Root tags (no prereqs) always unlocked

- [ ] p2.10: Add integration test
  - User starts with only root-level content
  - User masters prerequisites → new content unlocks

---

## Phase 3: InterferenceMitigator Strategy

**Status**: BLOCKED (waiting on Phase 1)

**Goal**: Reduce scores for cards sharing tags with recently-seen content. Uses delegate pattern.

### Tasks

- [ ] p3.1: Create `InterferenceMitigatorNavigator` class
  - New file: `packages/db/src/core/navigators/interferenceMitigator.ts`
  - Extends `ContentNavigator`
  - Has `delegate: ContentNavigator` field

- [ ] p3.2: Parse config from `serializedData`
  ```typescript
  interface InterferenceConfig {
    similarityDecay: number;     // default: 0.8
    lookbackCount: number;       // default: 10
    delegateStrategy?: string;   // default: "elo"
  }
  ```

- [ ] p3.3: Create delegate navigator (same pattern as Hierarchy)

- [ ] p3.4: Implement `getRecentlySeenCards(): Promise<string[]>`
  - Use `user.getSeenCards(courseId)`
  - Take last N cards (N = lookbackCount)

- [ ] p3.5: Implement `collectTags(cardIds): Promise<Set<string>>`
  - For each cardId, call `course.getAppliedTags(cardId)`
  - Collect all tags into a Set

- [ ] p3.6: Implement `jaccardSimilarity(tagsA: string[], tagsB: Set<string>): number`
  - `intersection = tagsA.filter(t => tagsB.has(t)).length`
  - `union = new Set([...tagsA, ...tagsB]).size`
  - Return `intersection / union` (or 0 if union is 0)

- [ ] p3.7: Implement `getWeightedCards(limit)`
  - Get candidates from delegate (over-fetch: `limit * 3`)
  - Get recent history tags
  - For each candidate:
    - Compute similarity with recent tags
    - Adjusted score = `delegate.score * (1.0 - similarity * similarityDecay)`
  - Sort by adjusted score, return top N

- [ ] p3.8: Implement legacy methods (delegate through)

- [ ] p3.9: Register in factory
  - Add to `Navigators` enum: `INTERFERENCE = 'interferenceMitigator'`

- [ ] p3.10: Add unit tests
  - Jaccard similarity calculation
  - Score adjustment: high similarity → reduced score
  - Delegate scores preserved and adjusted (not replaced)

- [ ] p3.11: Add integration test
  - Cards with similar tags to recent history appear later in returned list

---

## Phase 4: Orchestrator (DEFERRED)

**Status**: NOT STARTED — not needed for LP MVP

Delegate pattern handles composition for now. Full orchestrator needed for:
- Multi-arm bandit experimentation
- A/B testing independent strategies
- Dynamic strategy selection

---

## Notes for Implementers

### Key Files
- `packages/db/src/core/navigators/index.ts` — ContentNavigator base, factory, Navigators enum
- `packages/db/src/core/navigators/elo.ts` — Reference generator strategy
- `packages/db/src/core/interfaces/userDB.ts` — UserDBInterface (history, ELO)
- `packages/db/src/impl/couch/courseDB.ts` — Tag queries, ELO queries

### Commands
- Build: `yarn workspace @vue-skuilder/db build`
- Test: `yarn workspace @vue-skuilder/db test`
- Type check: `yarn workspace @vue-skuilder/db type-check`

### Scoring Semantics
- `1.0` = fully suitable
- `0.0` = hard filter (e.g., prerequisite not met)
- `0.5` = neutral
- Intermediate = soft preference

### Delegate Pattern
Filter strategies wrap a delegate and transform its output:
```
Interference(delegate=Hierarchy(delegate=ELO))
```
- ELO generates candidates with scores
- Hierarchy gates (filters locked cards, preserves scores)
- Interference adjusts scores (multiplicative reduction for similar tags)

### Data Access (via constructor params)
- `user: UserDBInterface`
  - `user.getSeenCards(courseId)` — card history
  - `user.getCourseRegDoc(courseId).elo.tags` — per-tag ELO
- `course: CourseDBInterface`
  - `course.getAppliedTags(cardId)` — tags on a card
  - `course.getCardEloData([cardId])` — card difficulty