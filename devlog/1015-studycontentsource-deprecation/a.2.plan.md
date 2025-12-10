# Plan: Remove Deprecated StudyContentSource Methods

## Selected Approach

Single PR with staged implementation:
1. Extend `WeightedCard` to support `reviewID` metadata
2. Update SRS navigator to populate `reviewID` in weighted cards
3. Refactor SessionController to use only `getWeightedCards()`
4. Remove HardcodedOrderNavigator (not production-ready)
5. Remove deprecated interface methods
6. Clean up all implementations

## Rationale

### Why extend WeightedCard with reviewID?
- SessionController line 573 needs `reviewID` when recording failed reviews
- This is the only piece of `ScheduledCard` metadata actually consumed
- Adding it as optional field preserves backward compat while enabling the migration

### Why remove HardcodedOrderNavigator?
- User confirmed it's "first cut" / experimental
- Adds complexity without production use
- hierarchyDefinition + ELO/SRS achieve similar pedagogical goals
- Reduces maintenance burden during refactor

### Why single PR?
- User preference for atomic changes
- E2e tests provide safety net
- TypeScript will guide us after interface removal (compile errors flag remaining usages)

## Implementation Sequence

### Phase 1: Extend WeightedCard Interface
**Goal:** Add optional `reviewID` field to support review metadata

**Files:**
- `packages/db/src/core/navigators/index.ts`

**Changes:**
```typescript
export interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;
  provenance: StrategyContribution[];
  tags?: string[];

  /**
   * Review document ID (_id from ScheduledCard).
   * Present when this card originated from SRS review scheduling.
   * Used by SessionController to track review outcomes.
   */
  reviewID?: string;
}
```

---

### Phase 2: Update SRS Navigator
**Goal:** Populate `reviewID` in weighted cards generated from reviews

**Files:**
- `packages/db/src/core/navigators/srs.ts`

**Changes:**
In `getWeightedCards()` method (around line 80-110), add `reviewID` to the returned `WeightedCard` objects:

```typescript
const scored: WeightedCard[] = reviews.map((review) => {
  const { score, reason } = this.computeUrgencyScore(review, now);

  return {
    cardId: review.cardId,
    courseId: this.course.getCourseID(),
    score,
    reviewID: review._id,  // <-- ADD THIS
    provenance: [
      {
        strategy: 'srs',
        strategyName: this.strategyName || this.name,
        strategyId: this.strategyId || 'NAVIGATION_STRATEGY-SRS-default',
        action: 'generated' as const,
        score,
        reason,
      },
    ],
  };
});
```

**Verification:** After this change, review-origin weighted cards will have `reviewID` populated.

---

### Phase 3: Refactor SessionController
**Goal:** Use only `getWeightedCards()`, eliminate `getPendingReviews()` call

**Files:**
- `packages/db/src/study/SessionController.ts`

**Current code (lines 286-308):**
```typescript
// Fetch weighted cards for mixing
const weighted = await source.getWeightedCards!(limit);

// Fetch full review data (we need ScheduledCard fields)
const reviews = await source.getPendingReviews().catch((error) => {
  this.error(`Failed to get reviews for source ${i}:`, error);
  return [];
});

batches.push({
  sourceIndex: i,
  weighted,
  reviews,
});

allReviews.push(...reviews);
```

**New code:**
```typescript
// Fetch weighted cards for mixing
const weighted = await source.getWeightedCards!(limit);

// Extract reviews from weighted cards (filter by origin)
const reviews: (StudySessionReviewItem & Pick<ScheduledCard, '_id'>)[] = weighted
  .filter((w) => getCardOrigin(w) === 'review')
  .map((w) => ({
    _id: w.reviewID!,  // reviewID is populated by SRS navigator
    cardId: w.cardId,
    courseId: w.courseId,
    cardID: w.cardId,   // StudySessionItem uses cardID (uppercase)
    courseID: w.courseId,
    contentSourceType: 'course' as const,
    contentSourceID: w.courseId,
    reviewID: w.reviewID!,
    status: 'review' as const,
  }));

batches.push({
  sourceIndex: i,
  weighted,
  reviews,
});

allReviews.push(...reviews);
```

**Changes to `SourceBatch` type (if needed):**
Check if `SourceBatch` interface expects full `ScheduledCard` fields. If so, we may need to adjust the type to accept `Pick<ScheduledCard, '_id'>` instead of full `ScheduledCard`.

**Verification:**
- SessionController no longer calls `source.getPendingReviews()`
- Review queue population still works (reviewID preserved)
- Failed review tracking (line 573) still has access to `reviewID`

---

### Phase 4: Remove HardcodedOrderNavigator
**Goal:** Delete experimental navigator to reduce complexity

**Files to delete:**
- `packages/db/src/core/navigators/hardcodedOrder.ts`

**Files to update:**
- `packages/db/src/core/navigators/index.ts` - Remove from exports
- Any strategy registration code that references it

**Search for usages:**
```bash
rg -i "hardcoded" packages/db/src
rg "HardcodedOrder" packages/db/src
```

**Verification:**
- No compile errors after removal
- No runtime references in strategy registration

---

### Phase 5: Remove Deprecated Interface Methods
**Goal:** Remove `getPendingReviews()` and `getNewCards()` from `StudyContentSource` interface

**Files:**
- `packages/db/src/core/interfaces/contentSource.ts`

**Changes:**
Remove the two deprecated methods from the interface:

```typescript
// DELETE THESE:
getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;
getNewCards(n?: number): Promise<StudySessionNewItem[]>;
```

Keep only:
```typescript
getWeightedCards?(limit: number): Promise<WeightedCard[]>;
```

**Expected TypeScript errors after this change:**
- All implementations that still define these methods will have "not assignable" errors
- All call sites (internal to implementations) will have "does not exist" errors

These errors will guide the next phase.

---

### Phase 6: Clean Up Implementations
**Goal:** Remove or inline deprecated method implementations across the codebase

**Approach:** Let TypeScript compiler guide us. After Phase 5, run:
```bash
yarn workspace @vue-skuilder/db tsc
```

For each file with errors, apply the appropriate fix pattern:

#### Pattern A: Implementations that wrap legacy methods in `getWeightedCards()`

**Files:**
- `packages/db/src/impl/couch/classroomDB.ts`
- `packages/db/src/study/TagFilteredContentSource.ts`
- `packages/db/src/impl/static/courseDB.ts`

**Fix:** Inline the legacy method logic directly into `getWeightedCards()`.

**Example (StudentClassroomDB):**

Before:
```typescript
async getWeightedCards(limit: number): Promise<WeightedCard[]> {
  const [newCards, reviews] = await Promise.all([this.getNewCards(), this.getPendingReviews()]);
  // ... map to WeightedCard[]
}

async getPendingReviews(): Promise<...> { /* implementation */ }
async getNewCards(): Promise<...> { /* implementation */ }
```

After:
```typescript
async getWeightedCards(limit: number): Promise<WeightedCard[]> {
  // Inline getPendingReviews logic
  const reviews = (await this._user.getPendingReviews())
    .filter((r) => r.scheduledFor === 'classroom' && r.schedulingAgentId === this._id)
    .map(/* transform */);

  // Inline getNewCards logic
  const assigned = await this.getAssignedCardIDs();
  const active = await this._user.getActiveCards();
  const newCards = assigned
    .filter((cardId) => !active.some((ac) => ac.cardID === cardId))
    .map(/* transform */);

  // Existing mapping to WeightedCard[]
  return [...newCards, ...reviews].map((item) => ({
    cardId: item.cardID,
    courseId: item.courseID,
    score: 1.0,
    reviewID: 'reviewID' in item ? item.reviewID : undefined,
    provenance: [/* ... */],
  }));
}

// DELETE getPendingReviews() and getNewCards()
```

#### Pattern B: Base class default implementation

**Files:**
- `packages/db/src/core/navigators/index.ts` (ContentNavigator base class)

**Fix:** The default `getWeightedCards()` implementation currently calls `getPendingReviews()` and `getNewCards()`. These are abstract methods that subclasses override.

**Decision:** Since all meaningful implementations (ELO, SRS) already override `getWeightedCards()` with proper scoring, we can:
- Make the default `getWeightedCards()` throw an error (forces subclasses to implement)
- Remove the abstract `getPendingReviews()` and `getNewCards()` declarations

```typescript
// DELETE these abstract declarations
abstract getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;
abstract getNewCards(n?: number): Promise<StudySessionNewItem[]>;

// UPDATE default implementation to throw
async getWeightedCards(limit: number): Promise<WeightedCard[]> {
  throw new Error(
    `${this.constructor.name} must implement getWeightedCards(). ` +
    `The legacy getPendingReviews/getNewCards methods have been removed.`
  );
}
```

#### Pattern C: CompositeGenerator and Pipeline delegation

**Files:**
- `packages/db/src/core/navigators/CompositeGenerator.ts`
- `packages/db/src/core/navigators/Pipeline.ts`

**Fix:** These delegate to wrapped generators. Remove the delegation methods since they're no longer part of the interface.

**CompositeGenerator:**
```typescript
// DELETE this method entirely
async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> { ... }
```

**Pipeline:**
```typescript
// DELETE this method entirely
async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> { ... }
```

These classes already implement `getWeightedCards()` properly, so they don't need the legacy methods.

#### Pattern D: ELO Navigator

**Files:**
- `packages/db/src/core/navigators/elo.ts`

**Current:** Implements `getNewCards()` and calls it from `getWeightedCards()`.

**Fix:** Inline the `getNewCards()` logic into `getWeightedCards()`:

```typescript
async getWeightedCards(limit: number, context?: GeneratorContext): Promise<WeightedCard[]> {
  // Determine user ELO (existing logic)
  let userGlobalElo: number;
  if (context?.userElo !== undefined) {
    userGlobalElo = context.userElo;
  } else {
    const courseReg = await this.user.getCourseRegDoc(this.course.getCourseID());
    const userElo = toCourseElo(courseReg.elo);
    userGlobalElo = userElo.global.score;
  }

  // INLINE getNewCards logic here
  const activeCards = await this.user.getActiveCards();
  const newCards = (
    await this.course.getClosestCards(
      { limit: limit, elo: 'user' },
      (c: QualifiedCardID) => !activeCards.some((ac) => c.cardID === ac.cardID)
    )
  ).map((c) => ({
    ...c,
    status: 'new' as const,
  }));

  // Get ELO data and score (existing logic)
  const cardIds = newCards.map((c) => c.cardID);
  const cardEloData = await this.course.getCardEloData(cardIds);

  const scored: WeightedCard[] = newCards.map((c, i) => {
    const cardElo = cardEloData[i]?.global?.score ?? 1000;
    const distance = Math.abs(cardElo - userGlobalElo);
    const score = Math.max(0, 1 - distance / 500);

    return {
      cardId: c.cardID,
      courseId: c.courseID,
      score,
      provenance: [/* ... */],
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// DELETE getNewCards() method
// DELETE getPendingReviews() stub
```

#### Pattern E: CourseDB delegation

**Files:**
- `packages/db/src/impl/couch/courseDB.ts`

**Current:** Delegates to navigator created by `createNavigator()`.

**Fix:** Remove the delegation methods entirely. The CourseDB already implements `StudyContentSource` through its navigator delegation in `getWeightedCards()`.

```typescript
// DELETE these methods:
public async getPendingReviews(): Promise<...> { ... }
public async getNewCards(n?: number = 999): Promise<...> { ... }
```

CourseDB's `getWeightedCards()` (if it exists) should remain, or it inherits behavior from the navigator.

#### Pattern F: UserCourseRelDB (special case)

**Files:**
- `packages/db/src/impl/couch/user-course-relDB.ts`

**Context:** This class has `getPendingReviews()` but does NOT implement `StudyContentSource`. It's a different context (user-course relationship tracking).

**Fix:** Leave it alone! This is not part of the StudyContentSource interface removal.

---

### Phase 7: Update Documentation and Comments
**Goal:** Remove references to deprecated API

**Files:**
- `packages/db/src/core/interfaces/contentSource.ts` - Remove migration notice comments
- `packages/db/docs/navigators-architecture.md` - Update to reflect removal completion

**Changes:**

**contentSource.ts:** Remove the large comment block (lines 9-39) explaining the migration, replace with:
```typescript
/**
 * Interface for sources that provide study content to SessionController.
 *
 * Content sources return scored candidates via getWeightedCards(), which
 * SessionController uses to populate study queues.
 *
 * See: packages/db/docs/navigators-architecture.md
 */
```

**navigators-architecture.md:** Add a completion note at the top:
```markdown
> **Migration Complete (2024-12-10)**: The legacy `getPendingReviews()` and
> `getNewCards()` methods have been removed from `StudyContentSource`. All
> content sources now use the unified `getWeightedCards()` API.
```

---

## Success Criteria

### Functional Requirements
- [ ] SessionController successfully populates review and new queues from `getWeightedCards()` only
- [ ] Failed review tracking still has access to `reviewID` (line 573 works)
- [ ] Review cards are correctly identified by `getCardOrigin()` and routed to reviewQ
- [ ] New cards are correctly identified and routed to newQ
- [ ] Study sessions can be started and cards can be presented

### Technical Requirements
- [ ] No TypeScript compile errors in `@vue-skuilder/db` package
- [ ] No runtime errors in study session initialization
- [ ] `WeightedCard` interface includes optional `reviewID` field
- [ ] SRS navigator populates `reviewID` for review cards
- [ ] HardcodedOrderNavigator completely removed
- [ ] `getPendingReviews()` and `getNewCards()` removed from `StudyContentSource` interface
- [ ] All implementations cleaned up (no orphaned methods)

### Test Requirements
- [ ] E2e Cypress tests pass (study session card rendering)
- [ ] Manual smoke test: Start study session, verify cards appear
- [ ] Manual verification: Check browser console for errors during session

---

## Known Risks & Mitigations

### Risk: SessionController type changes
If `SourceBatch` interface expects full `ScheduledCard` objects, we may need to adjust types.

**Mitigation:** Check the type definition and adjust to use `Pick<ScheduledCard, '_id'>` if needed.

### Risk: Missing reviewID in edge cases
If review cards flow through paths other than SRS navigator, they may lack `reviewID`.

**Mitigation:**
- Log warnings if `getCardOrigin(w) === 'review'` but `w.reviewID` is undefined
- Add runtime checks in SessionController

### Risk: Breaking classroom study sessions
StudentClassroomDB filters reviews by `scheduledFor === 'classroom'`. Inlining this logic must preserve the filter.

**Mitigation:** Careful review of the inlined logic, test with classroom study sessions if possible.

---

## File Change Summary

**Modified (8 files):**
- `packages/db/src/core/navigators/index.ts` - Extend WeightedCard, update base class
- `packages/db/src/core/navigators/srs.ts` - Populate reviewID
- `packages/db/src/study/SessionController.ts` - Remove getPendingReviews call
- `packages/db/src/impl/couch/classroomDB.ts` - Inline legacy methods
- `packages/db/src/study/TagFilteredContentSource.ts` - Inline legacy methods
- `packages/db/src/impl/static/courseDB.ts` - Inline legacy methods
- `packages/db/src/core/interfaces/contentSource.ts` - Remove methods, update docs
- `packages/db/docs/navigators-architecture.md` - Update documentation

**Deleted (1 file):**
- `packages/db/src/core/navigators/hardcodedOrder.ts`

**May need updates (pending compile errors):**
- `packages/db/src/core/navigators/CompositeGenerator.ts`
- `packages/db/src/core/navigators/Pipeline.ts`
- `packages/db/src/core/navigators/elo.ts`
- `packages/db/src/impl/couch/courseDB.ts`

**Total estimated changes:** ~10-12 files
