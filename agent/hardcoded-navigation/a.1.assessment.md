# Assessment: Hard-coded Content Navigation Strategy

## Summary of Goal

The user wants to implement a new `ContentNavigationStrategy` that allows a course to specify a fixed, linear progression of cards (e.g., Card A -> Card B -> Card C). This requires understanding the existing navigation strategy mechanism and creating a new implementation.

## How Navigation Strategies Work

Based on the code in `@packages/db/src`, the content navigation system has three main components:

1.  **`ContentNavigationStrategyData`**: This is a data document stored in a course's database. It defines a strategy's properties, including a crucial field: `implementingClass`. This field holds the name of the JavaScript/TypeScript class that executes the strategy's logic at runtime. The document also contains `serializedData`, a string field perfect for storing configuration, like our list of card IDs.

2.  **`ContentNavigator`**: This is an abstract class that defines the interface for all navigation strategies. The main methods are `getNewCards()` and `getPendingReviews()`. The existing `ELONavigator` is a concrete implementation of this.

3.  **The "Hook" - `CourseDB.surfaceNavigationStrategy()`**: This method on the `CourseDB` implementation is the critical link. When a study session needs a new card, it calls `getNewCards()` on the `CourseDB`. This, in turn, calls `surfaceNavigationStrategy()` to determine *which* strategy to use. It then uses `ContentNavigator.create()` to dynamically import and instantiate the correct navigator class based on the `implementingClass` field from the strategy document.

**The key takeaway is that `CourseDB.surfaceNavigationStrategy()` is currently hard-coded to always return the ELO-based strategy.** To support different strategies, this method needs to be made dynamic.

## How to Attach Strategies to Courses

To make the system flexible, we need a way to associate a course with a specific navigation strategy. Here's the proposed mechanism:

1.  **Modify `CourseConfig`**: The `CourseConfig` object is the natural place to store this setting. We would add an optional field, such as `defaultNavigationStrategyId: string`.

2.  **Update the Hook**: We will modify the `surfaceNavigationStrategy` method in `packages/db/src/impl/couch/courseDB.ts`. It will first attempt to read the `defaultNavigationStrategyId` from the course's `CourseConfig`.
    *   If the ID is found, it will load that `ContentNavigationStrategyData` document from the database.
    *   If the field is not set or the document isn't found, it will fall back to the default ELO strategy.

3.  **Implement Strategy Management**: The `addNavigationStrategy` and `updateNavigationStrategy` methods on `CourseDB` are currently stubs. We will need to implement them so that `ContentNavigationStrategyData` documents can be created and saved to the course database.

---

## Option for Implementation

### The Full Implementation (Recommended)

This approach involves creating the new navigator and updating the surrounding infrastructure to make the system fully dynamic and extensible.

1.  **Create `HardcodedOrderNavigator`**:
    *   Create a new file: `packages/db/src/core/navigators/hardcodedOrder.ts`.
    *   The class will extend `ContentNavigator`.
    *   Its constructor will parse the ordered list of card IDs from the `serializedData` field of its `ContentNavigationStrategyData` document.
    *   `getNewCards()` will serve cards sequentially from this list, filtering out any cards the user has already seen in the session.
    *   `getPendingReviews()` will return an empty array, as traditional SRS-style reviews don't fit a simple linear progression.

2.  **Implement Strategy Management in `CourseDB`**:
    *   Flesh out the `addNavigationStrategy` method in `packages/db/src/impl/couch/courseDB.ts` to allow creating and saving new `ContentNavigationStrategyData` documents.

3.  **Update the `surfaceNavigationStrategy` Hook**:
    *   Modify the method in `packages/db/src/impl/couch/courseDB.ts` to read the strategy ID from `CourseConfig`, as described above.

---

## Clarifying Questions

To ensure the implementation meets your expectations, I have a few questions:

1.  For this hard-coded order, what is the desired behavior if a user "fails" a card (e.g., answers a question incorrectly)? Should the card be presented again immediately, placed at the end of the session for review, or should the user simply move on to the next card in the sequence?

> we will reuse existing flows - missed cards go to the failed queue. the strategy is about encoding a sequence of first-exposures. Perhaps later we can extend to more complex "prerequisite" structure where success w/ card B is required before seeing card C.

2.  The current `ELONavigator` handles SRS-style reviews (`getPendingReviews`). My plan is for the new `HardcodedOrderNavigator` to ignore these and return an empty array. Is this correct?

> user: let's allow for SRS scheduling according to normal flow. For now, the is minimum viable navigationStrategy customization - testing the paths.

3.  The `serializedData` for this new strategy will contain the ordered list of card IDs. Who will be responsible for creating this list and the strategy document itself? Should I build a helper function or a CLI tool for this, or will this be handled by a UI you plan to build?

> user: we will build out some UI for this. I think there are placeholders already, but let's focus now on the data structures and runtime hooks for loading & using the new strategy.

---

## Recommendation

I recommend proceeding with the **Full Implementation**. It correctly uses the existing architecture and will make the entire navigation system robust and ready for any future strategies you might dream up.

J'attends vos instructions!
