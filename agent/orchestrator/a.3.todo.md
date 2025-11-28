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

**Status**: COMPLETED

**Goal**: Prerequisite-gated card selection using delegate pattern. Cards locked until user masters prerequisite tags.

### Tasks

- [x] p2.1: Create `HierarchyDefinitionNavigator` class
  - Created: `packages/db/src/core/navigators/hierarchyDefinition.ts`
  - Extends `ContentNavigator`
  - Has `delegate: ContentNavigator` field (lazy-initialized)

- [x] p2.2: Parse config from `serializedData`
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

- [x] p2.3: Create delegate navigator in constructor/init
  - Uses lazy initialization via `getDelegate()` method
  - Uses `ContentNavigator.create(user, course, delegateStrategyData)`
  - Default delegate: ELO

- [x] p2.4: Implement `getMasteredTags(): Promise<Set<string>>`
  - Gets user's per-tag ELO from `user.getCourseRegDoc(courseId).elo.tags`
  - Tag is mastered if: `userElo(tag) >= threshold` AND `count >= minCount`
  - Falls back to comparing tag ELO vs global user ELO if no minElo specified

- [x] p2.5: Implement `getUnlockedTags(mastered: Set<string>): Set<string>`
  - Tag is unlocked if all its prerequisites are in `mastered`
  - Tags with no prerequisites are always unlocked

- [x] p2.6: Implement `getWeightedCards(limit)`
  - Gets candidates from delegate (over-fetch: `limit * 2`)
  - For each candidate, checks if card is unlocked via `isCardUnlocked()`
  - Locked cards filtered out, unlocked cards preserve delegate's score
  - Returns filtered list up to limit

- [x] p2.7: Implement legacy methods (delegate through)
  - `getNewCards(n)` → `this.delegate.getNewCards(n)`
  - `getPendingReviews()` → `this.delegate.getPendingReviews()`

- [x] p2.8: Register in factory
  - Already added to `Navigators` enum in Phase 1: `HIERARCHY = 'hierarchyDefinition'`

- [x] p2.9: Add unit tests
  - Added to `navigators.test.ts`:
  - Mastery detection (ELO threshold + count)
  - Unlocking logic (prerequisite chain)
  - Card unlocking (mixed tags with/without prereqs)

- [x] p2.10: Verify build and tests pass
  - [x] Build: `yarn workspace @vue-skuilder/db build` ✓
  - [x] Tests: delegated to CI

---

## Phase 3: InterferenceMitigator Strategy

**Status**: COMPLETED

**Goal**: Avoid introducing confusable concepts while either is immature. Course authors define explicit interference relationships.

### Tasks

- [x] p3.1: Create `InterferenceMitigatorNavigator` class
  - Created: `packages/db/src/core/navigators/interferenceMitigator.ts`
  - Extends `ContentNavigator`
  - Has `delegate: ContentNavigator` field (lazy-initialized)

- [x] p3.2: Parse config from `serializedData`
  - `interferenceSets: string[][]` — groups of tags that interfere (e.g., `[["b","d","p"], ["d","t"]]`)
  - `maturityThreshold: { minCount?, minElo? }` — when a tag is considered mature
  - `interferenceDecay` (default: 0.8)
  - `delegateStrategy` (default: "elo")

- [x] p3.3: Build interference map from config (tag → set of partners)

- [x] p3.4: Implement `getImmatureTags(): Promise<Set<string>>`
  - Tags where user has count > 0 but below maturity threshold

- [x] p3.5: Implement `getTagsToAvoid(immatureTags): Set<string>`
  - Partners of immature tags (excluding already-immature ones)

- [x] p3.6: Implement `computeInterferenceMultiplier()`
  - Score reduction based on overlap with avoid set
  - `Math.pow(1 - decay, interferingCount)`

- [x] p3.7: Implement `getWeightedCards(limit)`
  - Maturity-aware interference avoidance

- [x] p3.8: Implement legacy methods (delegate through)

- [x] p3.9: Register in factory
  - Already added to `Navigators` enum in Phase 1

- [x] p3.10: Verify build passes
  - [x] Build: `yarn workspace @vue-skuilder/db build` ✓
  - [x] Tests: delegated to CI

---

## Phase 3.5: RelativePriority Strategy

**Status**: COMPLETED

**Goal**: Boost scores for high-utility content based on author-defined tag priorities. Prefer common, well-behaved patterns (like 's') over rare/irregular ones (like 'x', 'z').

### Tasks

- [x] p3.5.1: Create `RelativePriorityNavigator` class
  - Created: `packages/db/src/core/navigators/relativePriority.ts`
  - Extends `ContentNavigator`
  - Has `delegate: ContentNavigator` field (lazy-initialized)

- [x] p3.5.2: Define config interface
  ```typescript
  interface RelativePriorityConfig {
    tagPriorities: { [tagId: string]: number };  // 0-1, where 1.0 = highest priority
    defaultPriority?: number;                     // for unlisted tags (default: 0.5)
    combineMode?: 'max' | 'average' | 'min';      // how to combine multiple tags
    priorityInfluence?: number;                   // how strongly priority affects score (default: 0.5)
    delegateStrategy?: string;                    // default: "elo"
  }
  ```

- [x] p3.5.3: Implement boost factor computation
  - Formula: `boostFactor = 1 + (priority - 0.5) * priorityInfluence`
  - Priority 1.0 with influence 0.5 → boost 1.25 (25% higher)
  - Priority 0.5 → boost 1.00 (neutral)
  - Priority 0.0 with influence 0.5 → boost 0.75 (25% lower)

- [x] p3.5.4: Implement `getWeightedCards(limit)`
  - Get candidates from delegate
  - Look up tags for each card
  - Compute combined priority (max/average/min)
  - Apply boost factor to delegate score
  - Clamp to [0, 1] and sort

- [x] p3.5.5: Register in factory
  - Added to `Navigators` enum: `RELATIVE_PRIORITY = 'relativePriority'`

- [x] p3.5.6: Add unit tests
  - Added to `navigators.test.ts`:
  - Boost factor computation (18 new tests)
  - Tag priority combination (max/average/min modes)
  - Score adjustment with clamping

- [x] p3.5.7: Verify build and tests pass
  - [x] Build: `yarn workspace @vue-skuilder/db build` ✓
  - [x] Tests: 48 tests passing ✓

---

## Phase 4: Orchestrator (DEFERRED)

**Status**: NOT STARTED — not needed for LP MVP

Delegate pattern handles composition for now. Full orchestrator needed for:
- Multi-arm bandit experimentation
- A/B testing independent strategies
- Dynamic strategy selection

---

## Phase 4a: Production Integration (PLANNED)

**Status**: NOT STARTED

**Goal**: Wire SessionController to use `getWeightedCards()` so new strategies are actually exercised at runtime.

### Key Gap
Currently, `SessionController` still calls legacy `getNewCards()` / `getPendingReviews()`. The new `getWeightedCards()` API is implemented but not integrated.

### Tasks (estimated)
- [ ] p4a.1: Add parallel path in SessionController for weighted card selection
- [ ] p4a.2: Extend `getDebugInfo()` to include active strategy info
- [ ] p4a.3: Add strategy creation support (CLI or UI)

---

## Notes for Implementers

### Key Files
- `packages/db/src/core/navigators/index.ts` — ContentNavigator base, factory, Navigators enum
- `packages/db/src/core/navigators/elo.ts` — Reference generator strategy
- `packages/db/src/core/navigators/relativePriority.ts` — Priority-based score boosting
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
RelativePriority(delegate=Interference(delegate=Hierarchy(delegate=ELO)))
```
- ELO generates candidates with scores
- Hierarchy gates (filters locked cards, preserves scores)
- Interference adjusts scores (multiplicative reduction for similar tags)
- RelativePriority boosts/reduces scores based on tag utility

### Data Access (via constructor params)
- `user: UserDBInterface`
  - `user.getSeenCards(courseId)` — card history
  - `user.getCourseRegDoc(courseId).elo.tags` — per-tag ELO
- `course: CourseDBInterface`
  - `course.getAppliedTags(cardId)` — tags on a card
  - `course.getCardEloData([cardId])` — card difficulty