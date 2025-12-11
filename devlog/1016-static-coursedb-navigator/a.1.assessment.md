# Assessment: Update Static CourseDB to Use NavigationStrategy Architecture

## Context

The `StaticCourseDB` implementation (`packages/db/src/impl/static/courseDB.ts`) has a TODO comment on line 388:

```typescript
// TODO: replace these w/ ContentNavigator instantiation as in ../couch/courseDB.ts
```

This was left over from the original NavigationStrategy migration. The static provider currently implements `getWeightedCards()` with hardcoded logic instead of delegating to proper navigator strategies.

## Current State

### Static CourseDB Implementation (lines 387-436)

**What it does:**
1. Manually fetches new cards via `getCardsCenteredAtELO()`
2. Manually fetches reviews via `userDB.getPendingReviews()`
3. Maps both to `WeightedCard[]` with flat scores (1.0)
4. Assigns basic provenance: `strategy: 'static', strategyName: 'Static Data Provider'`

**Issues:**
1. ❌ **No proper scoring** - All cards get score=1.0 (no ELO distance, no SRS urgency)
2. ❌ **Wrong card ID** - Uses `r._id` for review cardId (should be `r.cardId`)
3. ❌ **No provenance trail** - Doesn't track which strategy/filter scored the card
4. ❌ **Bypasses architecture** - Doesn't use CompositeGenerator, Pipeline, or filters
5. ❌ **No strategy documents** - Returns hardcoded ELO strategy, doesn't persist or load custom strategies

### Couch CourseDB Implementation (lines 652-662)

**What it does:**
1. Gets/creates current user
2. Calls `createNavigator(user)` which:
   - Loads all navigation strategy documents
   - Uses PipelineAssembler to build Pipeline from strategies
   - Falls back to default Pipeline if no strategies or assembly fails
3. Delegates to `navigator.getWeightedCards(limit)`

**Benefits:**
- ✅ Proper ELO distance scoring for new cards
- ✅ SRS urgency scoring for reviews (overdue factor, interval recency)
- ✅ Complete provenance trails
- ✅ Supports custom strategies
- ✅ Filters (elo distance, hierarchy, interference, etc.) work automatically

## Default Pipeline Architecture

When no strategy documents exist, `createDefaultPipeline()` creates:

```
Pipeline(
  generator: CompositeGenerator([
    ELONavigator(user, course, defaultEloStrategy),
    SRSNavigator(user, course, defaultSrsStrategy)
  ]),
  filters: [
    eloDistanceFilter  // Filters cards too far from user's skill level
  ],
  user,
  course
)
```

This provides:
- **ELO Navigator**: Scores new cards by distance from user ELO (closer = higher score)
- **SRS Navigator**: Scores reviews by urgency (overdue, interval recency)
- **Composite**: Merges both generators' results
- **Filters**: Post-processes scores (e.g., penalize cards far from user level)

## Gap Analysis

### What Static CourseDB Needs

**Navigation Strategy Methods (lines 362-384):**
- Currently returns hardcoded ELO strategy only
- Needs to either:
  - Store strategies in static manifest (best)
  - OR fall back to defaults gracefully

**Navigator Creation:**
- Missing `createNavigator(user)` method
- Missing `createDefaultPipeline(user)` method
- Missing default strategy factory methods

**Imports:**
- Missing: `Pipeline`, `PipelineAssembler`, `CompositeGenerator`
- Missing: `ELONavigator`, `SRSNavigator`
- Missing: `createEloDistanceFilter`

### What Can Be Simplified

**PipelineAssembler:**
- Static mode likely doesn't need custom strategy assembly
- Can skip `getAllNavigationStrategies()` → `PipelineAssembler.assemble()`
- Can use default pipeline exclusively

**Rationale:**
- Static data is read-only, no UI to configure strategies
- Default (ELO + SRS + filters) covers 99% of use cases
- Keeps static provider simple

## Implementation Options

### Option A: Default Pipeline Only (Simple)

**Approach:**
1. Add `createDefaultPipeline(user)` method (copy from couch)
2. Update `getWeightedCards()` to call `createDefaultPipeline(user).getWeightedCards(limit)`
3. Update navigation strategy methods to return default strategies
4. Add required imports

**Pros:**
- Minimal code changes (~30 lines added, ~50 lines removed)
- No new dependencies on PipelineAssembler
- Matches couch behavior for 99% of use cases
- Fast to implement

**Cons:**
- Doesn't support custom strategies in static mode
- Slight inconsistency with couch (which checks strategy documents first)

**Files modified:** 1
- `packages/db/src/impl/static/courseDB.ts`

---

### Option B: Full PipelineAssembler Support (Complex)

**Approach:**
1. Add strategy documents to static manifest format
2. Add `createNavigator(user)` method (copy from couch)
3. Use PipelineAssembler to build from manifest strategies
4. Fall back to default pipeline if no strategies

**Pros:**
- Full parity with couch implementation
- Supports custom strategies in static courses
- More flexible for advanced users

**Cons:**
- Requires manifest format changes
- Requires re-packing all static courses
- More code to maintain
- PipelineAssembler dependency
- Significantly more work

**Files modified:** 3+
- `packages/db/src/impl/static/courseDB.ts`
- `packages/db/src/util/packer/types.ts` (manifest format)
- `packages/db/src/util/packer/index.ts` (packer logic)

---

### Option C: Hybrid (Pragmatic)

**Approach:**
1. Implement Option A (default pipeline)
2. Add `createNavigator(user)` that checks for strategies in manifest
3. If manifest has strategies, use PipelineAssembler
4. Otherwise, use default pipeline
5. No manifest format changes yet

**Pros:**
- Gets benefits of Option A immediately
- Leaves door open for Option B later
- No breaking changes to existing static courses
- Single file change

**Cons:**
- Slightly more complex than Option A
- PipelineAssembler code path won't be tested initially (no strategies in manifests)

**Files modified:** 1
- `packages/db/src/impl/static/courseDB.ts`

## Technical Risks

### Risk 1: UserDB Availability
The navigators need `UserDBInterface` to query pending reviews, active cards, course registration, etc.

**Impact:** Static mode already has `this.userDB` available, so this should work fine.

**Mitigation:** None needed.

### Risk 2: ELO Data in Static Manifest
The ELO navigator needs card ELO data to compute distances.

**Current:** Static manifest already includes card ELO data (line 119-126)

**Mitigation:** Verified already working.

### Risk 3: Review Scheduling in Static Mode
The SRS navigator queries `user.getPendingReviews()` which hits the user DB, not the static course data.

**Impact:** Reviews work independently of static vs couch course data.

**Mitigation:** No changes needed.

### Risk 4: Performance
Creating a Pipeline with Composite + filters for every `getWeightedCards()` call might be slower than the current hardcoded approach.

**Impact:** Likely negligible - navigator instantiation is fast, benefits outweigh cost.

**Mitigation:**
- Use default pipeline only (no PipelineAssembler overhead)
- Consider caching navigator instance if performance becomes an issue

## Recommendation

**Option A: Default Pipeline Only**

This is the pragmatic choice because:

1. **Immediate value** - Gets proper scoring/provenance with minimal work
2. **Minimal risk** - Single file change, well-tested navigator code
3. **Future-proof** - Can upgrade to Option C/B later if custom strategies needed
4. **Consistency** - Static courses will behave like couch courses (with default strategies)

### Implementation Plan

1. Add imports:
   ```typescript
   import { Pipeline } from '../../core/navigators/Pipeline';
   import CompositeGenerator from '../../core/navigators/CompositeGenerator';
   import ELONavigator from '../../core/navigators/elo';
   import SRSNavigator from '../../core/navigators/srs';
   import { createEloDistanceFilter } from '../../core/navigators/filters/eloDistance';
   ```

2. Add helper methods (copy from couch):
   ```typescript
   private makeDefaultEloStrategy(): ContentNavigationStrategyData { ... }
   private makeDefaultSrsStrategy(): ContentNavigationStrategyData { ... }
   private createDefaultPipeline(user: UserDBInterface): Pipeline { ... }
   ```

3. Update `getWeightedCards()`:
   ```typescript
   async getWeightedCards(limit: number): Promise<WeightedCard[]> {
     const pipeline = this.createDefaultPipeline(this.userDB);
     return pipeline.getWeightedCards(limit);
   }
   ```

4. Update navigation strategy methods to return defaults:
   ```typescript
   async getNavigationStrategy(id: string): Promise<ContentNavigationStrategyData> {
     if (id.includes('SRS')) return this.makeDefaultSrsStrategy();
     return this.makeDefaultEloStrategy();
   }

   async getAllNavigationStrategies(): Promise<ContentNavigationStrategyData[]> {
     return [this.makeDefaultEloStrategy(), this.makeDefaultSrsStrategy()];
   }
   ```

**Estimated effort:** ~1 hour
**Files changed:** 1
**Lines added:** ~40
**Lines removed:** ~50 (old getWeightedCards logic)
**Risk level:** Low

## Next Steps

If approved, I'll:
1. Create detailed implementation plan
2. Make the changes
3. Test with static course
4. Verify proper scoring/provenance in console
