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

## Phase 4: Remove HardcodedOrderNavigator
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

## Phase 6: Clean Up Implementations

### p6.1 ContentNavigator Base Class
- [ ] p6.1.1 Remove abstract method declarations for `getPendingReviews()` and `getNewCards()` from `packages/db/src/core/navigators/index.ts`
- [ ] p6.1.2 Update default `getWeightedCards()` implementation to throw error with migration message
- [ ] p6.1.3 Verify compile errors reduced

### p6.2 ELO Navigator
- [ ] p6.2.1 Inline `getNewCards()` logic into `getWeightedCards()` in `packages/db/src/core/navigators/elo.ts`
- [ ] p6.2.2 Delete `getNewCards()` method
- [ ] p6.2.3 Delete `getPendingReviews()` stub method if present
- [ ] p6.2.4 Verify compilation succeeds

### p6.3 SRS Navigator
- [ ] p6.3.1 Delete `getPendingReviews()` method from `packages/db/src/core/navigators/srs.ts` (logic already inlined in getWeightedCards as of Phase 2)
- [ ] p6.3.2 Delete `getNewCards()` stub method if present
- [ ] p6.3.3 Verify compilation succeeds

### p6.4 StudentClassroomDB
- [ ] p6.4.1 Inline `getPendingReviews()` and `getNewCards()` logic into `getWeightedCards()` in `packages/db/src/impl/couch/classroomDB.ts`
- [ ] p6.4.2 Ensure classroom filtering logic (`scheduledFor === 'classroom'`) is preserved
- [ ] p6.4.3 Delete `getPendingReviews()` and `getNewCards()` methods
- [ ] p6.4.4 Verify compilation succeeds

### p6.5 TagFilteredContentSource
- [ ] p6.5.1 Inline `getPendingReviews()` and `getNewCards()` logic into `getWeightedCards()` in `packages/db/src/study/TagFilteredContentSource.ts`
- [ ] p6.5.2 Ensure tag filtering logic is preserved
- [ ] p6.5.3 Delete `getPendingReviews()` and `getNewCards()` methods
- [ ] p6.5.4 Verify compilation succeeds

### p6.6 Static CourseDB
- [ ] p6.6.1 Inline `getPendingReviews()` and `getNewCards()` logic into `getWeightedCards()` in `packages/db/src/impl/static/courseDB.ts`
- [ ] p6.6.2 Delete `getPendingReviews()` and `getNewCards()` methods
- [ ] p6.6.3 Verify compilation succeeds

### p6.7 CourseDB
- [ ] p6.7.1 Remove `getPendingReviews()` and `getNewCards()` delegation methods from `packages/db/src/impl/couch/courseDB.ts`
- [ ] p6.7.2 Verify CourseDB's `getWeightedCards()` or navigator delegation still works
- [ ] p6.7.3 Verify compilation succeeds

### p6.8 CompositeGenerator
- [ ] p6.8.1 Delete `getPendingReviews()` delegation method from `packages/db/src/core/navigators/CompositeGenerator.ts`
- [ ] p6.8.2 Delete `getNewCards()` delegation method if present
- [ ] p6.8.3 Verify compilation succeeds

### p6.9 Pipeline
- [ ] p6.9.1 Delete `getPendingReviews()` delegation method from `packages/db/src/core/navigators/Pipeline.ts`
- [ ] p6.9.2 Delete `getNewCards()` delegation method if present
- [ ] p6.9.3 Verify compilation succeeds

### p6.10 Clean Up Test Mocks
- [ ] p6.10.1 Remove `getNewCards()` and `getPendingReviews()` from test mocks in `packages/db/tests/core/navigators/PipelineAssembler.test.ts`
- [ ] p6.10.2 Remove deprecated methods from any other test files with navigator mocks
- [ ] p6.10.3 Verify test compilation succeeds

### p6.11 Final Compilation and Grep Check
- [ ] p6.11.1 Run `yarn workspace @vue-skuilder/db tsc` and verify zero errors
- [ ] p6.11.2 Run `yarn workspace @vue-skuilder/db build` and verify successful build
- [ ] p6.11.3 Run `grep -r "getPendingReviews\|getNewCards" packages/db/src packages/db/tests` to verify all references removed

## Phase 7: Update Documentation
- [ ] p7.1 Remove migration notice comment block (lines ~9-39) from `packages/db/src/core/interfaces/contentSource.ts`
- [ ] p7.2 Replace with concise interface description referencing navigators-architecture.md
- [ ] p7.3 Add migration completion note to `packages/db/docs/navigators-architecture.md`
- [ ] p7.4 Update any @deprecated JSDoc tags that referenced these methods

## Phase 8: Testing & Verification
- [ ] p8.1 Run `yarn workspace @vue-skuilder/db lint:fix` to ensure code style
- [ ] p8.2 Start development environment (`yarn dev:platform`)
- [ ] p8.3 Manual test: Create/start a study session and verify cards appear
- [ ] p8.4 Manual test: Verify both new and review cards are presented
- [ ] p8.5 Manual test: Fail a review card and verify no errors (reviewID tracking works)
- [ ] p8.6 Check browser console for any runtime errors
- [ ] p8.7 Run e2e tests if available: `yarn test:e2e:*` (check for study session tests)

## Completion Checklist
- [ ] All TypeScript compilation errors resolved
- [ ] Build succeeds for @vue-skuilder/db package
- [ ] Manual smoke test passed (study session works)
- [ ] No runtime errors in browser console
- [ ] Documentation updated
- [ ] Ready for PR creation
