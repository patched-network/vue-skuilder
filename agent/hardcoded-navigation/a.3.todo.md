# To-Do List: Hard-coded Content Navigation Strategy

### Phase 1: `HardcodedOrderNavigator` Implementation

- [x] Create the file `packages/db/src/core/navigators/hardcodedOrder.ts`.
- [x] Define and implement the `HardcodedOrderNavigator` class.
    - [x] Constructor with `serializedData` parsing.
    - [x] `getNewCards()` method.
    - [x] `getPendingReviews()` method.
- [x] Add `HARDCODED = 'hardcodedOrder'` to the `Navigators` enum in `packages/db/src/core/navigators/index.ts`.
- [x] Export the new navigator from `packages/db/src/core/navigators/index.ts`.

### Phase 2: Strategy Management

- [x] Implement `addNavigationStrategy` in `packages/db/src/impl/couch/courseDB.ts`.

### Phase 3: Dynamic Strategy Selection

- [x] Modify `surfaceNavigationStrategy` in `packages/db/src/impl/couch/courseDB.ts` to dynamically select the strategy from `CourseConfig`.