# Docs course source

A short course about vue-skuilder, written for the docs site. It is a prototype: it runs on
[`/dbg/docs-course`](../dbg/docs-course.md) and is not yet on the frontpage. The design discussion
is in `agent/docs-course/` (not published).

## Build

```bash
yarn docs:course    # node docs/course-src/build.mjs
```

This writes `docs/public/static-courses/skuilder-docs/`, and needs the `@vue-skuilder/db` package
built (`yarn build:lib`). Commit the output with the source; the docs build does not run it.

The script builds framework documents (cards, data, tags, a strategy document, the course config)
in an in-memory PouchDB and packs them with `CouchDBToStaticPacker`, the same packer behind
`skuilder pack`. No CouchDB or Docker needed.

## Format

One file per docs section in `sections/`. Files sort by name; the order matters only for
readability.

```markdown
---
section: pedagogy                # tag suffix: docs:intro:pedagogy, docs:exercise:pedagogy
title: Pedagogy                  # shown in provenance and the progress panel
pages: learn/pedagogy            # docs pages that, once read, open this section's questions
open: true                       # optional: always open (orientation material)
---

## intro pedagogy-intro

Markdown for an information card. Link to the page it summarises.

## card ped-gate elo=1040

One question in the default card syntax, with exactly one blank, e.g. a {{gate||signal}}.
```

- The slug after `intro` / `card` becomes the card ID (`c-skdocs-<slug>`). Keep slugs stable:
  learners' history is keyed to them. Change the text freely; rename a slug only to retire a card.
- `elo=` is the starting difficulty (default 1000). Orientation cards sit below 1000, harder
  questions above.
- The build rejects a card with no blank or more than one (the default card type grades one), and
  a blank that is the last text of a card (it would not render).

## How gating works

- Each question is tagged `docs:exercise:<section>`, each intro `docs:intro:<section>`. These use
  the framework's tag roles, so per-section ratings are kept per learner.
- The course carries one strategy document, `docsReadingGate`, whose config maps sections to
  pages. The docs site registers that filter class
  (`docs/.vitepress/theme/docsCourse/DocsReadingGate.ts`).
- Every docs page notes, in localStorage, when it has been read
  (`docsCourse/DocsReadTracker.vue`). Before a session starts, those reads are merged into the
  learner's strategy state for the course (`docsCourse/reading.ts`).
- The filter opens a section's questions when one of its pages is read or its intro card has been
  seen, boosts them until the first is answered, and mostly skips intro cards for sections already
  read. Each decision is in the card's provenance.
- An app without the filter registered serves the course ungated, with a warning.
