---
section: custom-cards
title: Custom cards
pages: extend/custom-cards, extend/inline-components
---

## intro custom-cards-intro

**A custom card is a Vue component that can do anything**: a game loop, a chess board, a MIDI
keyboard. The platform cares about two moments: the view receives data, and the view submits an
answer.

`useViewable` and `useQuestionView` bridge the two: `submitAnswer(answer)` grades the answer with
your `Question` class and hands the record to the session. Register question classes in a
`CourseWare`, and add it to `allCourseWare`.

For a widget inside otherwise-markdown cards, an inline component is lighter.

[Read: Creating Custom Cards](/vue-skuilder/extend/custom-cards.html)

## card cc-boundary elo=1020

The platform cares about two moments in a custom card's life: it receives data, and {{it submits an answer||it unmounts|it fetches its own data}}.

## card cc-submit elo=1080

Inside a view, `submitAnswer(answer)` from `useQuestionView` {{grades the answer and hands a record to the session||writes straight to the user's database}}.

## card cc-register elo=1060

A study session finds your views through {{the allCourseWare registry||the Vue router|a global CSS class}}.

## card cc-name elo=1120

The scaffold names its courseware `ExampleCourse`. The time to rename it is {{before authoring real content||after the first deploy|never, since the name is ignored}}.

## card cc-inline elo=1000

For a custom widget inside otherwise-markdown cards, {{an inline component||a full custom card type}} is the lighter option.

## card cc-defer elo=1140

A view that plays an animation after answering can return {{deferAdvance||fluent: false|isCorrect: null}} and emit `ready-to-advance` when it's done.
