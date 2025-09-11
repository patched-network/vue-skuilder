# Plan: Hard-coded Content Navigation Strategy

**Objective**: Implement the `HardcodedOrderNavigator` and the necessary infrastructure to make content navigation strategies selectable on a per-course basis.

### Phase 1: Implement the `HardcodedOrderNavigator`

1.  **Create File**: Create the new navigator file at `packages/db/src/core/navigators/hardcodedOrder.ts`.
2.  **Define Class**: Implement the `HardcodedOrderNavigator` class, ensuring it extends `ContentNavigator`.
3.  **Constructor**: The constructor will expect `strategyData.serializedData` to be a JSON string containing an array of card IDs. It will parse this data and store the ordered list.
4.  **Implement `getNewCards()`**: This method will serve cards sequentially from the ordered list. It will consult the user's history (`user.getActiveCards()`) to filter out any cards that are already scheduled for review, ensuring cards are only presented once as "new".
5.  **Implement `getPendingReviews()`**: To preserve SRS functionality, this method will fetch the user's currently scheduled reviews for the course from the `UserDBInterface`. It will return these reviews without any special sorting.

### Phase 2: Implement Strategy Management

1.  **Update Enum**: Add a new entry for our navigator, `HARDCODED = 'hardcodedOrder'`, to the `Navigators` enum in `packages/db/src/core/navigators/index.ts`.
2.  **Implement `addNavigationStrategy`**: Flesh out the implementation of this method in `packages/db/src/impl/couch/courseDB.ts`. It will take `ContentNavigationStrategyData` and save it as a new document in the course's database.

### Phase 3: Dynamic Strategy Selection

1.  **Modify `surfaceNavigationStrategy`**: Update the hook method in `packages/db/src/impl/couch/courseDB.ts` to be dynamic.
2.  **Selection Logic**: The method will first inspect the course's `CourseConfig` for a `defaultNavigationStrategyId` field.
    *   If an ID is present, it will attempt to fetch the corresponding `ContentNavigationStrategyData` document from the database and use it.
    *   If the field is absent or the document is not found, it will log a warning and fall back to the default `ELONavigator`.
3.  **Assumption**: This plan assumes that the `CourseConfig` type (defined in `@vue-skuilder/common`) can be modified to include an optional `defaultNavigationStrategyId: string` field. I will proceed with this assumption.
