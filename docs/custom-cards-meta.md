# Meta: Requirements for "Creating Custom Cards" Documentation

This document outlines the requirements, goals, and context for creating the `custom-cards.md` documentation.

## 1. Target Audience & Context

-   **Audience:** A software developer with working knowledge of Vue.js and TypeScript.
-   **Context:** The developer has just successfully run `npx @vue-skuilder/cli init my-new-course`. They have a scaffolded project and are looking for the "what's next" guide to start building their first piece of custom, interactive course content.

## 2. Core Goals & User Stories

The primary goal is to empower the developer to build rich, interactive card types with confidence, understanding that the platform is a flexible host for their Vue components, not a restrictive framework.

-   **User Story 1:** After interacting with a live embedded card, the developer will immediately grasp the potential for creating complex, custom learning experiences.
-   **User Story 2:** After reading the doc, the developer will understand the relationship between a `Question` class (logic), a `View` component (UI), and a `DataShape` (data schema) by seeing them in the context of the live example.
-   **User Story 3:** After reading the doc, the developer will know exactly where to add their new files within their newly scaffolded course directory to define and register a new card type.
-   **User Story 4:** The developer will feel confident that they can build complex components with their own internal logic (e.g., game loops, state management) and see how to bridge them to the platform's lifecycle for evaluation.

## 3. Key Content & Technical Requirements

The documentation must be grounded in the practical reality of the scaffolded project and leverage the interactive capabilities of the VitePress docs site.

-   **Live Example First:** The document must lead with a fully interactive, embedded version of a non-trivial card. The existing "Falling Letters" typing game (`packages/courseware/src/typing/questions/falling-letters/`) is the perfect candidate. The opening of the doc should be, in essence: "Play this game. This is a custom card. This guide will show you how it works."
-   **Deconstruction of the Live Example:** The core of the documentation will be a breakdown of the live example the user just interacted with.
    -   "The game you just played is a single Vue component (`FallingLetters.vue`)."
    -   "Its difficulty is defined by a `DataShape` (speed, acceleration)."
    -   "Its logic is connected to the platform via the `FallingLettersQuestion` class."
-   **Core Concepts in Context:** The explanation of `Question`, `View`, and `DataShape` will be presented as a commentary on the working example, making the concepts concrete and immediately understandable.
-   **Practical "How-To":** The guide must still provide clear, actionable steps for the developer.
    1.  **Starting Point:** Explicitly reference the output of the CLI `init` command. Point the developer to `src/questions/index.ts` as the place to register their new `Question` types.
    2.  **File Structure:** Show the file structure for the example (`falling-letters/index.ts`, `falling-letters/view.vue`, etc.) as a template for them to follow.
    3.  **Registration:** Clearly show the one-line change needed in `src/questions/index.ts` to register the new card.
-   **Emphasis on Flexibility:** The doc must emphasize that the `View` is just a Vue component. The developer can use any libraries, state management, or rendering techniques they want. The `useQuestionView` composable is simply the bridge to tell the platform when the interaction is complete and what the result is.

## 4. Style & Constraints

-   **Reading Time:** The core concepts and walkthrough should be digestible in **under 10 minutes**. The live example provides the hook; the text should be concise and get straight to the point.
-   **Tone:** Empowering, exciting, and practical. It should read less like an API reference and more like a tutorial for building something cool.
-   **Format:** Markdown, with a live Vue component embedded at the top. Use code snippets (TypeScript and Vue) liberally to explain the deconstructed example. Use block quotes for emphasis on key concepts.