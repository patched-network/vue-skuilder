# Refactor Plan: Modularize Session Logic

## 1. Goal

Refactor `StudySession.vue` and `SessionController.ts` to establish a clean separation of concerns. The `SessionController` will be refactored to act as a **Façade**, orchestrating a suite of modular, single-purpose sub-services. This will make the view component "dumber" and the core logic more modular, testable, and extensible.

## 2. Target Architecture

1.  **`StudySession.vue` (The View):**
    -   Becomes a thin layer responsible for UI rendering and capturing user events.
    -   Its single major dependency for all study logic will be the `SessionController`.

2.  **`SessionController.ts` (The Façade/Orchestrator):**
    -   Provides a high-level API to the view layer (e.g., `nextCard()`, `submitResponse()`).
    -   It will no longer contain complex implementation details.
    -   Instead, it will be composed of and delegate to the various sub-services.

3.  **Sub-Services (The Logic):**
    -   New, single-purpose classes will be created to house the specific business logic.
    -   Examples:
        -   `SrsService.ts`: Handles Spaced Repetition scheduling logic.
        -   `EloService.ts`: Handles ELO score calculations and updates.
        -   `ResponseProcessor.ts`: Uses the above services to interpret a user's `CardRecord` and determine the outcome.
        -   `CardHydrator.ts`: (Optional but recommended) Handles the logic of fetching card data from the database.

## 3. Implementation Plan

### Phase 1: Create the Sub-Services

*This phase involves extracting the business logic currently in `StudySession.vue` into new, focused services.*

1.  **Create `SrsService.ts`:**
    -   **File:** `packages/db/src/study/services/SrsService.ts`
    -   **Responsibility:** Move the SRS scheduling logic (currently `scheduleReview` in `StudySession.vue`) into this service.

2.  **Create `EloService.ts`:**
    -   **File:** `packages/db/src/study/services/EloService.ts`
    -   **Responsibility:** Move the ELO calculation and update logic (currently `updateUserAndCardElo` in `StudySession.vue`) into this service.

3.  **Create `ResponseProcessor.ts`:**
    -   **File:** `packages/db/src/study/services/ResponseProcessor.ts`
    -   **Responsibility:** This service will use the `SrsService` and `EloService` to process a user's response and decide what action the `SessionController` should take next.

### Phase 2: Refactor `SessionController.ts` to act as a Façade

1.  **Update Constructor:** Modify the `SessionController` constructor to accept the new sub-services as dependencies (Dependency Injection).
2.  **Create `submitResponse` Method:** Add a new public method, `submitResponse(response: CardRecord)`, to the controller. This method will delegate the complex logic to the `ResponseProcessor` service and use the result to manage its internal queues.

### Phase 3: Simplify `StudySession.vue`

1.  **Update Instantiation:** In `initSession`, instantiate the `SessionController` and all the new sub-services it depends on.
2.  **Simplify `processResponse`:** The `processResponse` method will be reduced to a few lines: capture the response, call `sessionController.submitResponse()`, and then ask the controller for the next card.
3.  **Remove Migrated Logic:** Delete the `updateUserAndCardElo` and `scheduleReview` methods from the component, as that logic now lives in the new services.
