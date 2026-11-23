---
section: cards
title: Cards
pages: learn/card-data-model, learn/cards, default-cards
---

## intro cards-intro

**A card type has three parts:** a **DataShape** (its fields), a **Question** class (grades a response), and **views** (Vue components that render it).

Each card names its view: `{courseware}.question.{Question}.{View}`.

[Read: Card Data Model](/vue-skuilder/learn/card-data-model.html)

## card cm-trio elo=1000

A card type has a DataShape (its data schema), a Question (its grading), and {{one or more views (Vue components)||a reducer|a route}}.

## card cm-viewid elo=1100

A card's view ID embeds the question class and view component names, so renaming a view component {{breaks existing cards||is harmless, since IDs are random UUIDs}}.

## card cm-iscorrect elo=1060

A question's correct/incorrect verdict drives {{spaced repetition: extend or reset the interval||the card's rating only|nothing, since only performance matters}}.

## card cm-tagged elo=1120

A spelling card can grade `cat` spelled `kat` as `{ _global: 0.67, c: 0, a: 1, t: 1 }`, so that {{each letter's skill is rated separately||the card is retried three times|the answer is auto-corrected}}.

## card cm-multi-view elo=1080

One data shape can have several views (`7 + 4 = ?`, or "seven plus four?"). Varying the presentation helps avoid {{overfitting a skill to one presentation||duplicate rows in the database}}.

## card cm-double-bar elo=1020

In the default card syntax, the double bar `||` separates {{correct answers from distractors||one blank from the next|the question from its hint}}.

## card cm-seed elo=1140

A question type can ship its own content (say, every sum from 0+0 to 9+9) through {{static seedData||a CSV import|the MCP server}}.

## card cm-fluent elo=1150

An evaluation with `fluent: false` marks an answer as {{correct but too slow||wrong but close|skipped}}, so the card comes back sooner.
