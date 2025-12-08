# TODO: Batch Tag Hydration Implementation

## Status: ✅ COMPLETE

---

## Phase 1: Interface & Type Extensions ✅

### p1.1 Extend WeightedCard type ✅
- [x] Add `tags?: string[]` to `WeightedCard` interface
- File: `packages/db/src/core/navigators/index.ts`

### p1.2 Add batch method to CourseDBInterface ✅
- [x] Add `getAppliedTagsBatch(cardIds: string[]): Promise<Map<string, string[]>>` signature
- [x] Add JSDoc explaining the batch optimization
- File: `packages/db/src/core/interfaces/courseDB.ts`

---

## Phase 2: Backend Implementations ✅

### p2.1 CouchDB Implementation ✅
- [x] Implement `getAppliedTagsBatch()` in CourseDB class
- [x] Use CouchDB `keys` query parameter for batch lookup
- [x] Initialize all requested cardIds with empty arrays
- [x] Populate from query results, handling missing/null tag names
- File: `packages/db/src/impl/couch/courseDB.ts`

### p2.2 Static Implementation ✅
- [x] Implement `getAppliedTagsBatch()` in StaticCourseDB class
- [x] Use existing `tagsIndex.byCard` for O(1) lookups
- [x] Return empty arrays for cards not found in index
- File: `packages/db/src/impl/static/courseDB.ts`

---

## Phase 3: Pipeline Integration ✅

### p3.1 Add hydrateTags method to Pipeline ✅
- [x] Create private `hydrateTags(cards: WeightedCard[]): Promise<WeightedCard[]>` method
- [x] Handle empty cards array early return
- [x] Extract cardIds and call `getAppliedTagsBatch()`
- [x] Map tags onto cards, defaulting to empty array
- File: `packages/db/src/core/navigators/Pipeline.ts`

### p3.2 Integrate hydration into getWeightedCards ✅
- [x] Call `hydrateTags()` after generator, before filters loop
- [x] Add debug logging for hydration step
- File: `packages/db/src/core/navigators/Pipeline.ts`

---

## Phase 4: Filter Updates ✅

### p4.1 Update HierarchyDefinitionNavigator ✅
- [x] Modify `checkCardUnlock()` to accept `WeightedCard` and use `card.tags ?? []`
- [x] Remove fallback helper - rely on Pipeline hydration
- File: `packages/db/src/core/navigators/hierarchyDefinition.ts`

### p4.2 Update InterferenceMitigatorNavigator ✅
- [x] Simplify `getCardTags()` to synchronous `card.tags ?? []`
- [x] Remove async fallback - rely on Pipeline hydration
- File: `packages/db/src/core/navigators/interferenceMitigator.ts`

### p4.3 Update RelativePriorityNavigator ✅
- [x] Simplify `getCardTags()` to synchronous `card.tags ?? []`
- [x] Remove async fallback - rely on Pipeline hydration
- File: `packages/db/src/core/navigators/relativePriority.ts`

### p4.4 Update UserTagPreferenceFilter ✅
- [x] Simplify `getCardTags()` to synchronous `card.tags ?? []`
- [x] Remove async fallback - rely on Pipeline hydration
- File: `packages/db/src/core/navigators/filters/userTagPreference.ts`

---

## Phase 5: Verification

### p5.1 Build verification ✅
- [x] Run `yarn workspace @vue-skuilder/db build`
- [x] Fix any type errors
- [x] Fix test mocks to include `getAppliedTagsBatch`

### p5.2 Observability ✅
- [x] Add toggle-able logging helpers to Pipeline.ts:
  - `logPipelineConfig()` - shows generator + filter chain on construction
  - `logTagHydration()` - shows batch query effectiveness (cards/tags hydrated)
  - `logExecutionSummary()` - shows complete flow with counts and top scores
- [x] Wire logging helpers into Pipeline with clear "Toggle" comments
- [x] Helpers can be commented out individually for noise control

---

## Notes

### Signature Change Pattern for Filters

Before:
```typescript
private async getCardTags(cardId: string, course: CourseDBInterface): Promise<string[]>
```

After:
```typescript
private async getCardTags(card: WeightedCard, course: CourseDBInterface): Promise<string[]> {
  if (card.tags) {
    return card.tags;
  }
  // Fallback to individual query
  const tagResponse = await course.getAppliedTags(card.cardId);
  return tagResponse.rows.map(r => r.value?.name || r.key).filter(Boolean);
}
```

### Expected Query Reduction

| Scenario | Before (queries) | After (queries) |
|----------|------------------|-----------------|
| 20 cards × 3 filters | 60 | 1 |
| 50 cards × 4 filters | 200 | 1 |

### Dependencies

- Phase 2 depends on Phase 1
- Phase 3 depends on Phase 2
- Phase 4 depends on Phase 1 (type change), but can be done in parallel with Phase 2-3 if fallback is maintained