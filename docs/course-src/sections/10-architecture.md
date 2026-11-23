---
section: architecture
title: The big picture
pages: learn/architecture, glossary
---

## intro architecture-intro

**The study loop**: show a card, take a response, update the learner model, choose the next card.

- `StudySession` (Vue, in `@vue-skuilder/common-ui`) renders it.
- `SessionController` (in `@vue-skuilder/db`, no Vue) drives it.
- Each course is a *content source*: asked for cards, it runs its navigation pipeline and returns
  scored candidates.
- The controller keeps two queues: a **supply** queue (new cards and reviews, in rank order) and a
  **failed** queue (cards missed this session, cleared before the session ends).

[Read: The Big Picture](/vue-skuilder/learn/architecture.html)

## card arch-no-vue elo=1020

The `SessionController`, the navigation pipeline and the data layer live in `@vue-skuilder/db`, which {{has no Vue dependency||requires a Vue app instance}}.

## card arch-supply elo=1060

New cards and reviews are drawn from {{one supply queue, in pipeline rank order||separate new and review queues, mixed by a fixed ratio}}.

## card arch-failed elo=1000

A card you miss during a session goes to the failed queue, and the session won't end until {{it has been cleared||you review it tomorrow|the next session starts}}.

## card arch-replan elo=1080

When the supply queue runs low mid-session, the controller {{re-runs the pipeline (a replan)||ends the session early|repeats cards already seen}}.

## card arch-first-attempt elo=1120

Ratings and the review schedule are updated from {{the first attempt||the last attempt|the average of all attempts}} at a card in a presentation.

## card arch-content-source elo=1100

To a session, a course is a content source: something that answers `getWeightedCards(limit)` with {{scored candidate cards||a fixed list of card IDs|rendered Vue components}}.

## card arch-hydration elo=1040

Turning a selected card ID into something renderable (fetch its data, build its question, pick its view) is called {{hydration||compilation|serialization}}.
