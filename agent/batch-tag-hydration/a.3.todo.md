# TODO: Batch Tag Hydration Implementation

## Status: IN PROGRESS

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

## Phase 2: Backend Implementations

### p2.1 CouchDB Implementation
- [ ] Implement `getAppliedTagsBatch()` in CourseDB class
- [ ] Use CouchDB `keys` query parameter for batch lookup
- [ ] Initialize all requested cardIds with empty arrays
- [ ] Populate from query results, handling missing/null tag names
- File: `packages/db/src/impl/couch/courseDB.ts`

### p2.2 Static Implementation
- [ ] Implement `getAppliedTagsBatch()` in StaticCourseDB class
- [ ] Use existing `tagsIndex.byCard` for O(1) lookups
- [ ] Return empty arrays for cards not found in index
- File: `packages/db/src/impl/static/courseDB.ts`

---

## Phase 3: Pipeline Integration

### p3.1 Add hydrateTags method to Pipeline
- [ ] Create private `hydrateTags(cards: WeightedCard[]): Promise<WeightedCard[]>` method
- [ ] Handle empty cards array early return
- [ ] Extract cardIds and call `getAppliedTagsBatch()`
- [ ] Map tags onto cards, defaulting to empty array
- File: `packages/db/src/core/navigators/Pipeline.ts`

### p3.2 Integrate hydration into getWeightedCards
- [ ] Call `hydrateTags()` after generator, before filters loop
- [ ] Add debug logging for hydration step
- File: `packages/db/src/core/navigators/Pipeline.ts`

---

## Phase 4: Filter Updates

### p4.1 Update HierarchyDefinitionNavigator
- [ ] Modify `checkCardUnlock()` or tag lookup to accept `WeightedCard` with `tags` field
- [ ] Check `card.tags` before calling `getAppliedTags()`
- [ ] Maintain fallback to `getAppliedTags()` for backward compat
- File: `packages/db/src/core/navigators/hierarchyDefinition.ts`

### p4.2 Update InterferenceMitigatorNavigator
- [ ] Modify `getCardTags()` to accept optional pre-hydrated tags
- [ ] Prefer `card.tags` when available in `transform()`
- File: `packages/db/src/core/navigators/interferenceMitigator.ts`

### p4.3 Update RelativePriorityNavigator
- [ ] Modify `getCardTags()` to check `card.tags` first
- [ ] Pass card to method instead of just cardId
- File: `packages/db/src/core/navigators/relativePriority.ts`

### p4.4 Update UserTagPreferenceFilter
- [ ] Modify `getCardTags()` to check `card.tags` first
- [ ] Update `transform()` to pass full card to `getCardTags()`
- File: `packages/db/src/core/navigators/filters/userTagPreference.ts`

---

## Phase 5: Verification

### p5.1 Build verification
- [ ] Run `yarn workspace @vue-skuilder/db build`
- [ ] Fix any type errors

### p5.2 Functional verification
- [ ] Verify pipeline runs with logging showing single batch query
- [ ] Confirm filters still score correctly (no behavioral change)

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