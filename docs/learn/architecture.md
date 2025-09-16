# The Big Picture

![Architecture Diagram](../assets/sk-architecture.excalidraw.svg)

The focal point of `skuilder` is the main learning loop housed in the `StudySession.vue` component. If you ran the inline demo on the docs [frontpage](../index), you've encountered this loop first-hand. Here we will step through the lifecycle of a *Study Session* and describe the major components along the way.


## 0. Session Configuration

Before the loop begins, a few objects are created to parameterise the session.
- a list of `StudyContentSource`s
- a time limit for the session
- some user config (eg: confetti preference)

In the frontpage demo, the `StudyContentSource` is hard-coded. In an application with a single standalone course, that course would be hardcoded. In more general contexts, the contentSources may come from a user's registrations or selections from a menu.

A `StudyContentSource`, for practical purposes, is a `CourseDBInterface`. Courses are intended to be bundles of related curriculum. There is also a `ClassroomDBInterface`, which gives an administrator

*Note* that the studyContentSource at this point is passed by reference - just an ID string.

## 1. Preparing the SessionController

Having received a bundle of StudyContentSources, the SessionController instantiates data links

## 2.


To understand the system as a whole, it's best to start here and then fan out to the individual pieces.

A `StudySession` injests a `UserDBInterface` instance and one or more `StudyContentSource`s.
