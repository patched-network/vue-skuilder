# Todo: Remove Deprecated StudyContentSource Methods

## Phase 1: Extend WeightedCard Interface - COMPLETED
- [x] p1.1 Add optional `reviewID?: string` field to `WeightedCard` interface in `packages/db/src/core/navigators/index.ts`
- [x] p1.2 Add JSDoc comment explaining field usage (present for SRS review cards, used by SessionController)
- [x] p1.3 Verify TypeScript compilation succeeds

## Phase 2: Update SRS Navigator - COMPLETED
- [x] p2.1 Modify `getWeightedCards()` in `packages/db/src/core/navigators/srs.ts` to populate `reviewID: review._id` in returned WeightedCard objects
- [x] p2.2 Verify TypeScript compilation succeeds

## Phase 3: Refactor SessionController - COMPLETED
- [x] p3.1 Replace `getPendingReviews()` call in `SessionController.getWeightedContent()` (line ~292) with logic to extract reviews from weighted cards using `getCardOrigin()`
- [x] p3.2 Map filtered weighted cards to `StudySessionReviewItem` format, preserving `reviewID` field
- [x] p3.3 Update `SourceBatch.reviews` type from intersection type to `StudySessionReviewItem[]`
- [x] p3.4 Remove unused `ScheduledCard` import from SessionController
- [x] p3.5 Verify SessionController compiles and review queue population logic is preserved

## Phase 3.5: Simplify SessionController Queue Population - COMPLETED
- [x] p3.5.1 Remove `reviews` field from `SourceBatch` interface - mixer doesn't use it
- [x] p3.5.2 Remove `allReviews` accumulator from SessionController
- [x] p3.5.3 Remove review extraction from batch building loop
- [x] p3.5.4 Split `mixedWeighted` into reviews and new cards after mixing
- [x] p3.5.5 Populate both queues directly from mixed results
- [x] p3.5.6 Verify compilation and logic correctness

## Phase 4: Remove HardcodedOrderNavigator - COMPLETED
- [x] p4.1 Delete file `packages/db/src/core/navigators/hardcodedOrder.ts`
- [x] p4.2 Search for and remove any imports/exports of HardcodedOrderNavigator in `packages/db/src/core/navigators/index.ts`
- [x] p4.3 Search codebase for any references to `hardcodedOrder` or `HardcodedOrder` and remove
- [x] p4.3.1 Removed mock from `packages/db/tests/core/navigators/PipelineAssembler.test.ts`
- [x] p4.4 Verify TypeScript compilation succeeds

## Phase 5: Remove Deprecated Interface Methods - COMPLETED
- [x] p5.1 Remove `getPendingReviews()` method signature from `StudyContentSource` interface in `packages/db/src/core/interfaces/contentSource.ts`
- [x] p5.2 Remove `getNewCards()` method signature from `StudyContentSource` interface
- [x] p5.3 Remove unused `ScheduledCard` import from contentSource.ts
- [x] p5.4 Update interface JSDoc to reflect migration completion
- [x] p5.5 Made `getWeightedCards` required (removed `?` optional marker)
- [x] p5.6 Run TypeScript compilation - no new errors from interface change (ContentNavigator still has abstract methods)
- [x] p5.7 Document files requiring cleanup:
  - ContentNavigator base class (abstract methods)
  - ELO Navigator
  - SRS Navigator
  - StudentClassroomDB
  - TagFilteredContentSource
  - Static CourseDB
  - CourseDB (couch)
  - CompositeGenerator
  - Pipeline
  - Filter navigators (hierarchyDefinition, interferenceMitigator, relativePriority, userTagPreference)
  - BaseUserDB
  - user-course-relDB (note: NOT part of StudyContentSource - leave as-is)

## Phase 6: Clean Up Implementations - COMPLETED

### p6.1 ContentNavigator Base Class - COMPLETED
- [x] p6.1.1 Remove abstract method declarations for `getPendingReviews()` and `getNewCards()` from `packages/db/src/core/navigators/index.ts`
- [x] p6.1.2 Update default `getWeightedCards()` implementation to throw error with migration message
- [x] p6.1.3 Verify compile errors reduced

### p6.2 ELO Navigator - COMPLETED (already clean)
- [x] p6.2.1 Verified `getWeightedCards()` already inlines all logic
- [x] p6.2.2 No `getNewCards()` method exists - already removed
- [x] p6.2.3 No `getPendingReviews()` stub exists - already removed
- [x] p6.2.4 Verified compilation succeeds

### p6.3 SRS Navigator - COMPLETED (already clean)
- [x] p6.3.1 Verified `getWeightedCards()` already inlines all review logic
- [x] p6.3.2 No `getNewCards()` stub exists - already removed
- [x] p6.3.3 Verified compilation succeeds

### p6.4 StudentClassroomDB - COMPLETED
- [x] p6.4.1 Inlined `getPendingReviews()` and `getNewCards()` logic into `getWeightedCards()` in `packages/db/src/impl/couch/classroomDB.ts`
- [x] p6.4.2 Preserved classroom filtering logic (`scheduledFor === 'classroom'`)
- [x] p6.4.3 Deleted `getPendingReviews()` and `getNewCards()` methods
- [x] p6.4.4 Verified compilation succeeds

### p6.5 TagFilteredContentSource - COMPLETED
- [x] p6.5.1 Inlined `getPendingReviews()` and `getNewCards()` logic into `getWeightedCards()` in `packages/db/src/study/TagFilteredContentSource.ts`
- [x] p6.5.2 Preserved tag filtering logic
- [x] p6.5.3 Deleted `getPendingReviews()` and `getNewCards()` methods
- [x] p6.5.4 Verified compilation succeeds

### p6.6 Static CourseDB - COMPLETED
- [x] p6.6.1 Inlined `getNewCards()` logic into `getWeightedCards()` in `packages/db/src/impl/static/courseDB.ts`
- [x] p6.6.2 Deleted `getPendingReviews()` and `getNewCards()` methods
- [x] p6.6.3 Removed `getNewCards()` from `CourseDBInterface`
- [x] p6.6.4 Verified compilation succeeds

### p6.7 CourseDB (couch) - COMPLETED (already clean)
- [x] p6.7.1 Verified no `getPendingReviews()` or `getNewCards()` methods exist
- [x] p6.7.2 Verified `getWeightedCards()` delegates to navigator properly
- [x] p6.7.3 Verified compilation succeeds

### p6.8 CompositeGenerator - COMPLETED (already clean)
- [x] p6.8.1 Verified no `getPendingReviews()` delegation method exists
- [x] p6.8.2 Verified no `getNewCards()` delegation method exists
- [x] p6.8.3 Verified compilation succeeds

### p6.9 Pipeline - COMPLETED (already clean)
- [x] p6.9.1 Verified no `getPendingReviews()` delegation method exists
- [x] p6.9.2 Verified no `getNewCards()` delegation method exists
- [x] p6.9.3 Verified compilation succeeds

### p6.10 Filter Navigators - COMPLETED
- [x] p6.10.1 Removed `getNewCards()` and `getPendingReviews()` stubs from `hierarchyDefinition.ts`
- [x] p6.10.2 Removed `getNewCards()` and `getPendingReviews()` stubs from `interferenceMitigator.ts`
- [x] p6.10.3 Removed `getNewCards()` and `getPendingReviews()` stubs from `relativePriority.ts`
- [x] p6.10.4 Removed `getNewCards()` and `getPendingReviews()` stubs from `userTagPreference.ts`
- [x] p6.10.5 Cleaned up unused imports in all filter navigators

### p6.11 Interface Updates - COMPLETED
- [x] p6.11.1 Removed `getPendingReviews()` and `getNewCards()` from `StudentClassroomDBInterface`
- [x] p6.11.2 Made `ContentNavigator` constructor parameters optional to support CompositeGenerator pattern

### p6.12 Clean Up Test Mocks - COMPLETED
- [x] p6.12.1 Removed `getNewCards()` and `getPendingReviews()` from MockGenerator in `CompositeGenerator.test.ts`
- [x] p6.12.2 Removed deprecated method tests from `CompositeGenerator.test.ts`
- [x] p6.12.3 Removed `getNewCards()` and `getPendingReviews()` from MockGenerator in `Pipeline.test.ts`
- [x] p6.12.4 Removed legacy API compatibility tests from `Pipeline.test.ts`
- [x] p6.12.5 Updated `PipelineAssembler.test.ts` mock navigator classes (removed deprecated methods)
- [x] p6.12.6 Updated `navigators.test.ts` to test new architecture (base class throws error)
- [x] p6.12.7 Added `name` property to mock generators to satisfy `CardGenerator` interface

### p6.13 Final Compilation and Grep Check - COMPLETED
- [x] p6.13.1 Run `yarn workspace @vue-skuilder/db tsc` - zero errors
- [x] p6.13.2 Run `yarn workspace @vue-skuilder/db build` - successful build
- [x] p6.13.3 Grep check verified remaining references are:
  - Comments/error messages (expected)
  - `UserDBInterface.getPendingReviews()` (different interface, not part of this migration)
  - `user-course-relDB.getPendingReviews()` (implements UserDBInterface, not StudyContentSource)

## Phase 7: Update Documentation
- [x] p7.1 Verified `packages/db/src/core/interfaces/contentSource.ts` already has concise interface description
- [ ] p7.2 Add migration completion note to `packages/db/docs/navigators-architecture.md`
- [ ] p7.3 Update any @deprecated JSDoc tags that referenced these methods

## Phase 8: Testing & Verification
- [x] p8.1 Run `yarn workspace @vue-skuilder/db lint:fix` - passed (fixed empty interface lint error)
- [ ] p8.2 Start development environment (`yarn dev:platform`)
- [ ] p8.3 Manual test: Create/start a study session and verify cards appear
- [ ] p8.4 Manual test: Verify both new and review cards are presented
- [ ] p8.5 Manual test: Fail a review card and verify no errors (reviewID tracking works)
- [ ] p8.6 Check browser console for any runtime errors
- [ ] p8.7 Run e2e tests if available: `yarn test:e2e:*` (check for study session tests)

## Completion Checklist
- [x] All TypeScript compilation errors resolved
- [x] Build succeeds for @vue-skuilder/db package
- [ ] Manual smoke test passed (study session works)
- [ ] No runtime errors in browser console
- [ ] Documentation updated
- [ ] Ready for PR creation

## Summary of Changes Made in Phase 6

### Files Modified:
1. `packages/db/src/core/navigators/index.ts` - Made constructor params optional
2. `packages/db/src/core/navigators/hierarchyDefinition.ts` - Removed legacy stubs and unused imports
3. `packages/db/src/core/navigators/interferenceMitigator.ts` - Removed legacy stubs and unused imports
4. `packages/db/src/core/navigators/relativePriority.ts` - Removed legacy stubs and unused imports
5. `packages/db/src/core/navigators/filters/userTagPreference.ts` - Removed legacy stubs and unused imports
6. `packages/db/src/core/navigators/CompositeGenerator.ts` - Fixed context parameter handling
7. `packages/db/src/impl/couch/classroomDB.ts` - Inlined legacy methods into getWeightedCards
8. `packages/db/src/impl/couch/courseDB.ts` - Removed unused imports
9. `packages/db/src/impl/static/courseDB.ts` - Inlined legacy methods into getWeightedCards
10. `packages/db/src/study/TagFilteredContentSource.ts` - Inlined legacy methods into getWeightedCards
11. `packages/db/src/core/interfaces/courseDB.ts` - Removed `getNewCards()` from interface
12. `packages/db/src/core/interfaces/classroomDB.ts` - Removed legacy methods from StudentClassroomDBInterface
13. `packages/db/tests/core/navigators/CompositeGenerator.test.ts` - Updated tests for new API
14. `packages/db/tests/core/navigators/Pipeline.test.ts` - Removed legacy API tests
15. `packages/db/tests/core/navigators/PipelineAssembler.test.ts` - Cleaned up mock navigators
16. `packages/db/tests/core/navigators/navigators.test.ts` - Updated to test new architecture