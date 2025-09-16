# The Big Picture

![Architecture Diagram](../assets/sk-architecture.excalidraw.svg)

The focal point of `skuilder` is the main learning loop housed in the `StudySession.vue` component. If you ran the inline demo on the docs [frontpage](../index), you've encountered this loop first-hand. Here we will step through the lifecycle of a *Study Session* and describe the major components along the way.

::: warning !!!
This diagram is not *strictly* accurate in terms of named entities or functions, but is right in spirit.
:::

## 0. Session Startup

### 0.1 Configuration

Before the loop begins, a few objects are created to parameterise the session.
- a list of `StudyContentSource`s
- a time limit for the session
- some user config (eg: confetti preference)

In the frontpage demo, the `StudyContentSource` is hard-coded. In an application with a single standalone course, that course would be hardcoded. In more general contexts, the contentSources may come from a user's registrations or selections from a menu.

The `StudyContentSource` at this point is passed by reference - just an ID string.

### 0.2 Initialization

`StudyContentSource` is a small interface:

<<< @../../packages/db/src/core/interfaces/contentSource.ts#docs_StudyContentSource

The behaviour of a course depends (in obvious ways!) on both the course content and the current user. To instantiate


### 0.3 Hydration



## 1. Instantiating the



Having received a bundle of StudyContentSources, the SessionController instantiates data links to those sources.



## 2.


To understand the system as a whole, it's best to start here and then fan out to the individual pieces.

A `StudySession` injests a `UserDBInterface` instance and one or more `StudyContentSource`s.
