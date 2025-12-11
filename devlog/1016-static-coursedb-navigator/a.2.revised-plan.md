# Revised Plan: Static CourseDB Navigator Support

## Goal
Make static courses full-fidelity snapshots of live courses by supporting custom navigation strategies, not just hardcoded defaults.

## Architecture Decision

**Use the same `createNavigator()` pattern as couch CourseDB:**
1. Query for navigation strategy documents from static data
2. Use `PipelineAssembler` to build Pipeline from those strategies
3. Fall back to default Pipeline if no strategies found
4. Delegate to `navigator.getWeightedCards(limit)`

This ensures static courses exhibit identical behavior to their live counterparts.

## Shared Code Abstraction

**Created:** `packages/db/src/core/navigators/defaults.ts` - Shared default pipeline factory

This module provides:
- `createDefaultEloStrategy(courseId)` - Factory for default ELO strategy data
- `createDefaultSrsStrategy(courseId)` - Factory for default SRS strategy data
- `createDefaultPipeline(user, course)` - Factory for default Pipeline(Composite(ELO, SRS), [eloDistanceFilter])

**Already refactored:** `packages/db/src/impl/couch/courseDB.ts` to use shared defaults

This eliminates ~40 lines of duplicated code between implementations and provides a single source of truth for default pipeline configuration.

## Implementation Approach

### Phase 0: Create Shared Defaults Module - ✅ COMPLETED

**Created file:** `packages/db/src/core/navigators/defaults.ts`
**Refactored:** `packages/db/src/impl/couch/courseDB.ts` to use shared module

**Changes:**
- Extracted 3 private methods from couch courseDB to shared module
- Removed 4 navigator imports from couch courseDB (now only in defaults.ts)
- Net: +84 lines (new file), -40 lines (removed duplication)

### Phase 1: Add Document Query Method to StaticDataUnpacker - ✅ COMPLETED

**File:** `packages/db/src/impl/static/StaticDataUnpacker.ts`

**Added method:** `getAllDocumentsByPrefix(prefix: string)` (lines 98-137)

**Implementation details:**
- Uses lexicographic range matching: `chunk.startKey <= prefixEnd && chunk.endKey >= prefix`
- Uses `prefix + '\ufff0'` as range end to match all documents starting with prefix
- Loads all relevant chunks in parallel via `Promise.all()`
- Filters `documentCache` for IDs starting with prefix
- Hydrates attachments for each matching document
- Returns empty array with debug log if no chunks found (graceful handling)
- Added debug logging for found chunks and document count

**Changes:**
- Added ~40 lines
- TypeScript compilation clean
- Build successful

### - [x] Phase 2: Update StaticCourseDB Navigation Strategy Methods

**File:** `packages/db/src/impl/static/courseDB.ts`

**Update `getAllNavigationStrategies()`:**
```typescript
async getAllNavigationStrategies(): Promise<ContentNavigationStrategyData[]> {
  const prefix = DocTypePrefixes[DocType.NAVIGATION_STRATEGY];
  try {
    const docs = await this.unpacker.getAllDocumentsByPrefix(prefix);
    return docs as ContentNavigationStrategyData[];
  } catch (error) {
    logger.warn(`[static/courseDB] Error loading navigation strategies: ${error}`);
    return []; // Fall back to default pipeline
  }
}
```

**Update `getNavigationStrategy()`:**
```typescript
async getNavigationStrategy(id: string): Promise<ContentNavigationStrategyData> {
  try {
    return await this.unpacker.getDocument(id);
  } catch (error) {
    logger.error(`[static/courseDB] Strategy ${id} not found: ${error}`);
    throw error;
  }
}
```

### Phase 3: Add Navigator Creation Method

**File:** `packages/db/src/impl/static/courseDB.ts`

**Add imports:**
```typescript
import { ContentNavigator } from '../../core/navigators';
import { PipelineAssembler } from '../../core/navigators/PipelineAssembler';
import { createDefaultPipeline } from '../../core/navigators/defaults';
import { DocTypePrefixes } from '../../core/types/types-legacy';
```

**Add method:**
```typescript
/**
 * Create a ContentNavigator for this course.
 *
 * Loads navigation strategy documents from static data and uses PipelineAssembler
 * to build a Pipeline. Falls back to default pipeline if no strategies found.
 */
async createNavigator(user: UserDBInterface): Promise<ContentNavigator> {
  try {
    const allStrategies = await this.getAllNavigationStrategies();

    if (allStrategies.length === 0) {
      logger.debug(
        '[static/courseDB] No strategy documents found, using default Pipeline(Composite(ELO, SRS), [eloDistanceFilter])'
      );
      return createDefaultPipeline(user, this);
    }

    // Use PipelineAssembler to build Pipeline from strategy documents
    const assembler = new PipelineAssembler();
    const { pipeline, generatorStrategies, filterStrategies, warnings } =
      await assembler.assemble({
        strategies: allStrategies,
        user,
        course: this,
      });

    // Log warnings
    for (const warning of warnings) {
      logger.warn(`[PipelineAssembler] ${warning}`);
    }

    if (!pipeline) {
      logger.debug('[static/courseDB] Pipeline assembly failed, using default pipeline');
      return createDefaultPipeline(user, this);
    }

    logger.debug(
      `[static/courseDB] Using assembled pipeline with ${generatorStrategies.length} generator(s) and ${filterStrategies.length} filter(s)`
    );
    return pipeline;
  } catch (e) {
    logger.error(`[static/courseDB] Error creating navigator: ${e}`);
    throw e;
  }
}
```

**Note:** Uses shared `createDefaultPipeline()` from `defaults.ts` - no duplication of default strategy/pipeline factory methods.

### Phase 4: Replace getWeightedCards Implementation

**File:** `packages/db/src/impl/static/courseDB.ts`

**Replace lines 387-436:**
```typescript
async getWeightedCards(limit: number): Promise<WeightedCard[]> {
  try {
    const navigator = await this.createNavigator(this.userDB);
    return navigator.getWeightedCards(limit);
  } catch (e) {
    logger.error(`[static/courseDB] Error getting weighted cards: ${e}`);
    throw e;
  }
}
```

**Remove:** Old hardcoded implementation (~50 lines)

### Phase 5: Verify Packer Includes Navigation Strategies

**File:** `packages/db/src/util/packer/CouchDBToStaticPacker.ts` (probably)

**Check:**
- Does the packer already include all document types when chunking?
- If it filters by docType, ensure NAVIGATION_STRATEGY is included


**Expected:** Packer likely already includes all documents, so no changes needed. Just verify.

>>> I have observed NAVIAGATION_STRATEGY documents in packed courses, yes.

## Verification Plan

### 1. Check Existing Packed Courses
```bash
# Look at manifest of an existing packed course
cat packages/standalone-ui/public/courses/<course-id>/manifest.json | jq '.chunks[] | select(.docType == "NAVIGATION_STRATEGY")'
```

**Expected outcomes:**
- **If chunk exists:** Strategies already being packed, just need to load them
- **If no chunk:** Need to verify packer includes them, may need to repack courses

### 2. Test with Static Course
```typescript
// In browser console after loading static course
const course = await getDataLayer().getCourseDB('some-static-course');
const strategies = await course.getAllNavigationStrategies();
console.log('Strategies:', strategies);

const weighted = await course.getWeightedCards(20);
console.log('Weighted cards:', weighted);
// Check provenance trails - should show proper strategy names, not just "static"
```

### 3. Compare Couch vs Static
Load the same course (one from couch, one static snapshot) and verify:
- Same number of strategies returned
- Same weighted cards with same scores
- Same provenance trails

## Benefits

1. **Full Parity** - Static courses behave identically to live courses
2. **Custom Strategies** - Instructors' custom navigation configs work offline
3. **Proper Scoring** - ELO distance, SRS urgency, filter adjustments all work
4. **Rich Provenance** - Full audit trails of strategy decisions
5. **Future-Proof** - New navigators/filters work automatically in static mode

## Risks & Mitigations

### Risk 1: Strategies Not In Packed Courses
Existing packed courses might not include NAVIGATION_STRATEGY documents.

**Mitigation:**
- Graceful fallback to default pipeline (already implemented)
>>> recreate (or abstract and re-use) the default fallback pipeline contstruction from couchdb courses - using the elo and srs navigatores (navigators/elo.ts, navigators/srs.ts)
- Document need to repack courses if custom strategies desired
- Add warning log if using default due to missing strategies

### Risk 2: Strategy References Missing Classes
A strategy doc might reference a navigator class that doesn't exist in static mode.

**Mitigation:**
- PipelineAssembler already handles this gracefully
- Falls back to default pipeline on assembly failure
- Logs warnings about missing classes

### Risk 3: Performance
Loading strategy chunk adds overhead vs hardcoded default.

**Mitigation:**
- Chunk loading is cached, only happens once per session
- Strategy document query is fast (small chunk)
- Navigator instantiation is already fast in couch mode

## Estimated Effort

**Development:**
- Phase 0 (Shared defaults module): ✅ COMPLETED
  - Created `defaults.ts` with shared factory functions
  - Refactored couch courseDB to use shared code
  - Eliminated ~40 lines of duplication
- Phase 1 (Unpacker method): 30 min
- Phase 2 (Strategy methods): 15 min
- Phase 3 (Navigator method): 20 min (copy structure from couch, use shared defaults)
- Phase 4 (getWeightedCards): 5 min
- Phase 5 (Verify packer): 15 min (already confirmed strategies are packed)

**Testing:**
- Verify with existing packed course: 30 min
- Test fallback behavior: 15 min
- Compare couch vs static: 30 min

**Total remaining: ~2.5 hours**

**Files Changed:** 3 total
- `packages/db/src/core/navigators/defaults.ts` - ✅ Created (+84 lines)
- `packages/db/src/impl/couch/courseDB.ts` - ✅ Refactored (-40 lines duplication)
- `packages/db/src/impl/static/StaticDataUnpacker.ts` - TODO (+1 method, ~20 lines)
- `packages/db/src/impl/static/courseDB.ts` - TODO (+4 imports, +1 method, ~60 lines added, ~50 removed)

**Risk Level:** Low
- Navigation strategies confirmed present in packed courses
- Shared defaults provide consistent fallback behavior
- PipelineAssembler handles missing/invalid strategies gracefully
