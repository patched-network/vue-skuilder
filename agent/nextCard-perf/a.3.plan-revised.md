# Revised Plan for `nextCard()` Performance

This plan outlines the steps to implement a client-side pre-fetching strategy to eliminate interactive lag when displaying study cards.

## Core Strategy

We will modify the `SessionController` to maintain a small, rolling buffer of fully hydrated card objects. Instead of the UI being responsible for fetching card data on-demand, the `SessionController` will proactively fetch the next few cards in the background.

## Implementation Steps

1.  **Introduce a Hydrated Card Queue:**
    *   Create a new queue within `SessionController`, let's call it `hydratedQ`. This queue will store fully resolved card objects, including their view and data components.
    *   The `nextCard()` function will now draw directly from this `hydratedQ`.

2.  **Implement a Pre-fetching Mechanism:**
    *   Create a new private method in `SessionController`, e.g., `_fillHydratedQueue()`.
    *   This method will run in the background and ensure that `hydratedQ` always contains a target number of cards (e.g., 5).
    *   It will peek at the upcoming card IDs in the `reviewQ` and `newQ`, fetch their full data from CouchDB, and push the hydrated objects into `hydratedQ`.

3.  **Modify `nextCard()` Logic:**
    *   The `nextCard()` function will be updated to:
        1.  Dequeue a hydrated card from `hydratedQ` and return it to the UI.
        2.  After dequeuing, it will trigger the `_fillHydratedQueue()` method asynchronously to ensure the buffer is refilled in the background.

4.  **Initial Hydration:**
    *   During `prepareSession()`, after the initial queues are populated, we will make an initial call to `_fillHydratedQueue()` to populate the buffer for the start of the session.

## Task Breakdown

I will create a `a.4.todo.md` file with a detailed task breakdown for implementing this plan.
