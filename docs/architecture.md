The focal point of `skuilder` is the main learning loop housed in the `StudySession.vue` component. If you ran the inline demo on the docs [frontpage](./index), you've encountered this loop first-hand. If you haven't, here it is again:

To understand the system as a whole, it's best to start here and then fan out to the individual pieces.

A `StudySession` injests a `UserDBInterface` instance and one or more `StudyContentSource`s.
