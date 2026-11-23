---
section: strategies
title: Navigation strategies
pages: extend/navigation-strategies
---

## intro strategies-intro

**Extending the pipeline:** write a generator or a filter, register it at app start, and enable it with a strategy document in the course.

*This course does exactly that*: a filter that holds back questions on pages you haven't read.

[Read: Navigation Strategies](/vue-skuilder/extend/navigation-strategies.html)

## card ns-register elo=1040

A custom filter is registered at app start, then enabled for a course by {{a strategy document naming it||an entry in package.json|a CSS class on its cards}}.

## card ns-multiplier elo=1080

Because every filter multiplies scores, {{filter order doesn't change the final score||the last filter always wins}}.

## card ns-zero elo=1020

A filter that scores a card 0 {{excludes it from the run||sends it to the failed queue}}.

## card ns-state elo=1100

A filter and the app can share one source of truth by reading and writing the same {{strategy state document||Vue store|URL parameter}}.

## card ns-meta elo=1060

This course's questions are held back by a custom filter that reads {{which docs pages you've read||your GitHub activity|the server's access logs}}.

## card ns-unknown elo=1140

If a strategy document names a class the app never registered, the pipeline {{skips it with a warning||refuses to start the session}}.
