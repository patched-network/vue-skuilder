---
section: pedagogy
title: Pedagogy
pages: learn/pedagogy
---

## intro pedagogy-intro

**How the next card is chosen.** Every plan runs the course's pipeline:

`Generate → Filter → Drop zeros → Regulate → Hints → Diversity re-rank → Select`

- **Generators** propose candidates: new cards near your rating, due reviews, authored targets.
- **Filters** multiply scores. A *gate* says "not ready yet"; a *signal* expresses preference.
- **Regulators** balance reviews against new material.

Every card carries **provenance**: what each stage did to its score, and why. Ratings are kept
globally and per skill (tag), and practice leans toward your weakest skills.

[Read: Pedagogy](/vue-skuilder/learn/pedagogy.html)

## card ped-generators elo=1000

In the navigation pipeline, {{generators||filters|regulators}} propose candidate cards; filters then multiply their scores.

## card ped-gate elo=1040

A filter that means "not ready yet", such as a prerequisite check, is a {{gate||signal}}.

## card ped-intake elo=1140

Pressure for new material can lift new cards, but only those {{no gate held back||with the highest ratings|the learner has seen before}}.

## card ped-provenance elo=1020

Each selected card carries provenance: {{a record of what each stage did to its score, and why||its author and edit history|the URL it was loaded from}}.

## card ped-eligible elo=1060

Review due dates mean {{eligible||overdue}}: the system keeps a healthy backlog of reviews rather than racing it to zero.

## card ped-gain elo=1100

Scoring is gain-based, so a correct but slow answer {{gains less||lowers the learner's rating}}.

## card ped-skill-pressure elo=1080

The skill pressure filter boosts cards on a learner's {{weakest or least settled skills||most recently practiced skills|highest-rated skills}}.

## card ped-diversity elo=1150

The diversity re-rank demotes a card whose distinctive tags {{already appear among higher-ranked cards||are unknown to the course}}.

## card ped-orchestration elo=1160

Evolutionary orchestration (tuning strategy weights from learner outcomes) is currently {{partly wired: weights vary, but outcomes aren't recorded yet||fully running in production}}.
