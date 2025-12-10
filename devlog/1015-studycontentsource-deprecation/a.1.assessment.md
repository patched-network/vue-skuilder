# Assessment: Remove Deprecated StudyContentSource Methods

## Context

The `StudyContentSource` interface in `packages/db/src/core/interfaces/contentSource.ts` contains two deprecated methods that need to be removed:

- `getPendingReviews()` - Returns review cards scheduled by SRS algorithm
- `getNewCards(n?: number)` - Returns new cards ordered by ELO proximity

These methods represent an outdated API split that reflected hard-coded navigation strategies (ELO for new cards, SRS for reviews). The system has migrated to a unified `getWeightedCards()` API that returns scored candidates from any strategy.

## Current State

### Interface Implementers (4 classes)

| Class | Location | getWeightedCards() Status |
|-------|----------|--------------------------|
| **ContentNavigator** | `packages/db/src/core/navigators/index.ts:253` | Default implementation wraps legacy methods |
| **CourseDB** | `packages/db/src/impl/couch/courseDB.ts:102` | Inherits default from ContentNavigator |
| **StudentClassroomDB** | `packages/db/src/impl/couch/classroomDB.ts:77` | Concrete override wrapping legacy methods |
| **TagFilteredContentSource** | `packages/db/src/study/TagFilteredContentSource.ts:24` | Concrete override wrapping legacy methods |

All four implementers already have `getWeightedCards()` available. The deprecated methods are currently called **internally** within these `getWeightedCards()` implementations.

### Call Sites

**Critical External Usage:**
- `SessionController.getWeightedContent()` (line 292) - Directly calls `source.getPendingReviews()` to fetch full `ScheduledCard` metadata for queue population

**Internal Infrastructure Usage (10 files):**
- `TagFilteredContentSource.getWeightedCards()` - wraps legacy methods
- `StudentClassroomDB.getWeightedCards()` - wraps legacy methods
- `CourseDB.getPendingReviews()` - delegates to navigator
- `ContentNavigator.getWeightedCards()` - default wrapper implementation
- `HardcodedOrderNavigator.getWeightedCards()` - calls `getPendingReviews()` for review card scoring
- `CompositeGenerator.getPendingReviews()` - merges results from multiple generators
- `Pipeline.getPendingReviews()` - delegates to wrapped generator
- Static `CourseDB.getWeightedCards()` - wraps legacy methods
- `UserCourseRelDB.getPendingReviews()` - different context (user-course relation, not content source)

## Options

### Option A: Full Removal with Inline Refactoring

**Approach:**
1. Remove deprecated method signatures from `StudyContentSource` interface
2. For each implementer, inline the logic from the deprecated methods directly into `getWeightedCards()`
3. Update `SessionController` to use `getWeightedCards()` exclusively
4. Remove all deprecated method implementations across the codebase

**Pros:**
- Clean break, no lingering technical debt
- Forces complete migration to new API
- Simplifies interface contract
- Better long-term maintainability

**Cons:**
- Large change surface (10+ files)
- Risk of breaking subtle behavioral differences
- Requires understanding the internal logic of each implementation
- May uncover edge cases in SessionController that depend on full review metadata

**Estimated scope:** ~10-12 files modified, medium complexity

---

### Option B: Staged Removal (Interface → Implementations → Callers)

**Approach:**
1. First pass: Update `SessionController` to eliminate direct calls to deprecated methods
2. Second pass: Remove deprecated method signatures from interface (TypeScript will flag remaining usages)
3. Third pass: Clean up implementations file-by-file, guided by compile errors

**Pros:**
- Incremental validation at each stage
- Easier to isolate and debug issues
- Can commit/test after each phase
- TypeScript compiler helps identify remaining usages

**Cons:**
- More steps to complete
- Temporary intermediate states may feel awkward
- Takes longer overall

**Estimated scope:** 3 distinct phases, can be done across multiple sessions

---

### Option C: Soft Deprecation with Runtime Warnings

**Approach:**
1. Keep interface methods but add runtime deprecation warnings
2. Update implementations to log warnings when legacy methods are called
3. Monitor logs to identify any unexpected usage
4. Remove methods only after confidence period

**Pros:**
- Safest approach, can catch unexpected callers
- Allows production monitoring
- Easy rollback if issues arise

**Cons:**
- Extends technical debt timeline
- Adds log noise during transition
- Doesn't actually remove the methods (task incomplete)
- Not aligned with the stated goal of removal

**Estimated scope:** Minimal changes, but indefinite timeline to completion

---

### Option D: Preserve Methods for Legacy Navigators Only

**Approach:**
1. Remove deprecated methods from `StudyContentSource` interface
2. Keep implementations in `ContentNavigator` base class as protected helpers
3. Create a separate `LegacyContentSource` interface with these methods for backward compat
4. Update only the interface consumers (SessionController, etc.) to use `getWeightedCards()`

**Pros:**
- Cleans up public API while preserving internal implementation helpers
- Minimal refactoring of existing navigator logic
- Provides escape hatch for future legacy needs

**Cons:**
- Introduces new interface complexity
- Doesn't actually remove the code
- May encourage continued use of legacy patterns
- Unclear benefit vs. just keeping methods private

**Estimated scope:** ~5-7 files, medium complexity

## Technical Risks

### Risk 1: ScheduledCard Metadata Loss
The `getPendingReviews()` method returns `(StudySessionReviewItem & ScheduledCard)[]`, which includes full SRS scheduling metadata. The `getWeightedCards()` API returns `WeightedCard[]`, which doesn't include this metadata by default.

**Impact:** SessionController line 292 specifically needs this metadata to populate review queues.

**Mitigation:** Either:
- Extend `WeightedCard` to optionally include `ScheduledCard` data
- Have `getWeightedCards()` implementations attach scheduling metadata when source='review'
- Add a separate hydration step in SessionController after getting weighted cards

>>> History: ELO based new-surfacing and SRS based review surfacing were the two hard-coded generators that resulted in the two interface methods and the distinct queues in SessionController. SRS has now been refactored from a distinct hard-coded entity into a generator that produces from the getWeightedCards method (I THINK). The short of it : I am not confident that this usage still makes sense, or that it makes much sense for SessionController to maintain separate newQ and reviewQ - indeed I'm pretty sure reviewQ stays empty now from start to finish.

Added:

const reviews = await source.getPendingReviews().catch((error) => {
          this.error(`Failed to get reviews for source ${i}:`, error);
          return [];
        });

        logger.debug(
          `[reviews] fetched ${reviews.length} reviews -${reviews.map((r) => `\n\t${r.contentSourceID}::${r.cardID}`)}`
        );


and - oops - this path __is__ getting used:

[DB:DEBUG] [reviews] fetched 33 reviews -
	a9fae15687220aa6ce62018005040a8f::a9fae15687220aa6ce62018005066eb8,
	a9fae15687220aa6ce62018005040a8f::a9fae15687220aa6ce6201800506999f,
	a9fae15687220aa6ce62018005040a8f::a9fae15687220aa6ce6201800506dfef,
	a9fae15687220aa6ce62018005040a8f::a9fae15687220aa6ce62018005085b29,
	a9fae15687220aa6ce62018005040a8f::a9fae15687220aa6ce6201800506abbb,
	a9fae15687220aa6ce62018005040a8f::a9fae15687220aa6ce62018005051f29,
	a9fae15687220aa6ce62018005040a8f::a9fae15687220aa6ce62018005070e48,
	a9fae15687220aa6ce62018005040a8f::a9fae15687220aa6ce62018005056606,
	a9fae15687220aa6ce62018005040a8f::a9fae15687220aa6ce6201800507d2f3,
	a9fae15687220aa6ce62018005040a8f::a9fae15687220aa6ce620180050672d0,
	a9fae15687220aa6ce62018005040a8f::a9fae15687220aa6ce6201800507c919,
	a9fae15687220aa6ce62018005040a8f::a9fae15687220aa6ce62018005082214,
	a9fae15687220aa6ce62018005040a8f::a9fae15687220aa6ce6201800504df3e,
	a9fae15687220aa6ce62018005040a8f::a9fae15687220aa6ce6201800505bd37,
	a9fae15687220aa6ce62018005040a8f::a9fae15687220aa6ce620180050854bf,
	a9fae15687220aa6ce62018005040a8f::a9fae15687220aa6ce620180050491ea,
	a9fae15687220aa6ce62018005040a8f::a9fae15687220aa6ce620180050760f0,
	a9fae15687220aa6ce62018005040a8f::a9fae15687220aa6ce62018005077eb8,

But afaik the default pipe also calls into `navigators/srs.ts` getWeightedCards:

yes:  (srs.ts)   logger.debug(`[srsNav] got ${scored.length} weighted cards`);

	[DB:DEBUG] [srsNav] got 213 weighted cards
	[DB:DEBUG] [srsNav] got 213 reviews
	
so this is *duplicated* and the cards probably end up on __both__ queues

question is: does the different metadata get lost in processing and does the system manage rescheduling correctly when it takes these cards from the "main" newQ
<<<

### Risk 2: Behavioral Differences in Filters
Some implementers (e.g., `StudentClassroomDB`) filter reviews by `scheduledFor === 'classroom'`. This logic happens inside `getPendingReviews()`. If we inline this into `getWeightedCards()`, we need to ensure the filtering behavior is preserved.

**Impact:** Could incorrectly return classroom reviews that aren't scheduled for classroom study.

**Mitigation:** Careful review of each implementation's filtering logic during inlining.

### Risk 3: HardcodedOrder Strategy Dependency
`HardcodedOrderNavigator.getWeightedCards()` (line 111) explicitly calls `this.getPendingReviews()` to get review cards. This is a generator strategy that needs reviews as input to score them by position.

**Impact:** Removing the method would break this strategy unless we refactor its internal logic.

**Mitigation:** Replace `getPendingReviews()` call with direct user database query (same source).

>>> this strategy was a 'first cut' against the interface definition and is less production-ready in any case. I *think* its functionality can be reproduced by the hierarchyDefinition strategy? Can you confirm? we can probablyt just remove this entirely.

### Risk 4: CompositeGenerator Merging Logic
`CompositeGenerator` merges `getPendingReviews()` results from multiple generators with deduplication. If generators no longer expose this method, the composite can't merge review results.

**Impact:** Could break multi-strategy compositions that include both ELO and SRS generators.

**Mitigation:** Have `CompositeGenerator.getWeightedCards()` call `getWeightedCards()` on each sub-generator and merge/deduplicate the resulting `WeightedCard[]` arrays instead.

## Key Questions

1. **Review Metadata:** How should `getWeightedCards()` communicate full `ScheduledCard` metadata to SessionController? Should we extend `WeightedCard` or handle this differently?

>>> afaict, this metadata doesn't actually get read in SessionController ?

2. **Internal vs. Public API:** Should we distinguish between interface methods (public contract) and implementation helpers (internal usage)? Is there value in keeping these methods as protected helpers in `ContentNavigator`?

>>> no strong opinion.

3. **Testing:** Do we have sufficient test coverage to validate behavioral equivalence after refactoring?

>>> there is e2e cypress coverage that ensures at least that *cards get from DB into a running study session** (and get rendered)

4. **Rollout:** Do we want to do this in a single PR or break it into phases with separate PRs?

>>> single PR. 

# Recommendation

**Recommended Approach: Option B (Staged Removal) with Risk Mitigation**

I recommend the staged approach for these reasons:

1. **Safety:** Breaking this into phases allows validation at each step. We can catch issues early without needing to debug a massive change.

2. **TypeScript Guidance:** Once we remove the interface signatures, the compiler will flag every remaining usage, making it impossible to miss a call site.

3. **Incremental Progress:** We can commit and test after each phase, making it easier to bisect if issues arise.

4. **Addresses Key Risk:** We'll tackle the SessionController metadata dependency first, which is the most critical risk.

### Recommended Staged Plan

**Phase 1: Eliminate SessionController Dependency**
- Refactor `SessionController.getWeightedContent()` to use only `getWeightedCards()`
- If review metadata is needed, either:
  - Query it separately from `user.getPendingReviews()` after getting weighted cards
  - OR extend `WeightedCard` with optional `schedulingData?: ScheduledCard`
  - OR make Pipeline hydrate this data (similar to how it hydrates tags)

**Phase 2: Remove Interface Signatures**
- Remove `getPendingReviews()` and `getNewCards()` from `StudyContentSource` interface
- Compile to identify all remaining usages via TypeScript errors

**Phase 3: Refactor Implementations**
- For each file with compile errors, inline the deprecated method logic into `getWeightedCards()`
- Special attention to:
  - `HardcodedOrderNavigator` - replace `getPendingReviews()` with direct user DB query
  - `CompositeGenerator` - merge `WeightedCard[]` arrays instead of legacy arrays
  - `StudentClassroomDB` / `TagFilteredContentSource` - preserve filtering behavior

**Phase 4: Cleanup**
- Remove now-unused method implementations from `ContentNavigator` base class
- Update any documentation references
- Run full test suite

### Next Steps

If this approach is approved, I'll create a detailed plan document with specific file-by-file changes for each phase.
