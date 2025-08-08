# `nextCard()` Performance TODO

This file breaks down the tasks required to implement the client-side pre-fetching strategy.

## Phase 1: Core `SessionController` Modifications

-   [x] **Task 1.1:** In `SessionController.ts`, define a new interface `HydratedCard` that represents a fully resolved card object (including its view and data).
-   [x] **Task 1.2:** In `SessionController.ts`, add a new private queue property: `private hydratedQ: ItemQueue<HydratedCard> = new ItemQueue<HydratedCard>();`
-   [x] **Task 1.3:** In `SessionController.ts`, create a new private async method `_fillHydratedQueue()`. This method will be responsible for the pre-fetching logic.

## Phase 2: Pre-fetching Logic

-   [ ] **Task 2.1:** Inside `_fillHydratedQueue()`, implement the logic to determine how many cards to fetch (target buffer size is 5).
-   [ ] **Task 2.2:** Inside `_fillHydratedQueue()`, peek at the next items in `reviewQ` and `newQ` to get their card IDs.
-   [ ] **Task 2.3:** For each card ID, implement the necessary calls to fetch the full card document and its associated data document from CouchDB.
-   [ ] **Task 2.4:** Once fetched, create `HydratedCard` objects and enqueue them into `hydratedQ`.

## Phase 3: Update `nextCard()` and `prepareSession()`

-   [ ] **Task 3.1:** Modify the `nextCard()` function to dequeue from `hydratedQ` instead of the other queues.
-   [ ] **Task 3.2:** After dequeuing in `nextCard()`, add a non-blocking call to `_fillHydratedQueue()` to trigger the background pre-fetch.
-   [ ] **Task 3.3:** In `prepareSession()`, after the `reviewQ` and `newQ` are populated, add an initial `await this._fillHydratedQueue()` call to ensure the buffer is ready for the first card.

## Phase 4: UI and Verification

-   [ ] **Task 4.1:** Adjust the UI component that calls `nextCard()` to expect the new `HydratedCard` object, removing its own data-fetching logic.
-   [ ] **Task 4.2:** Manually test the study session flow to confirm that cards load quickly and that there are no errors.
-   [ ] **Task 4.3:** Use browser developer tools to verify that network requests for card data are happening *before* a card is displayed, not when it is requested.
