# Glossary

Terms as this documentation and the codebase use them.

## Systems

**Interactive tutoring system (ITS)**: software that teaches by interaction: it poses tasks,
observes responses, and gives feedback, rather than only presenting material.

**Adaptive tutoring system**: an ITS whose choice of what comes next depends on a model of the
learner, updated from their responses. Skuilder's model is ratings (ELO) plus review schedules
(SRS).

**SRS++**: shorthand for spaced repetition extended beyond flashcard recall: interactive card
types, per-skill ratings, and selection that blends review with new material, prerequisites, and
difficulty matching.

## Content

**Card**: one unit of study; usually the thing on screen. A card document references one or more
data documents and names a view. See [Card Data Model](./learn/card-data-model).

**DataShape**: the schema for a card type's data: named, typed fields.

**Question**: a class that holds a card's data and grades responses (`isCorrect`, a performance
score, optionally per tag). A `Displayable` that isn't a `Question` is an information card.

**View**: the Vue component that renders a card. One question type may have several views.

**View ID**: the string on a card naming how to render it:
`{courseware}.question.{QuestionClass}.{ViewName}`.

**Courseware**: a named group of question types (`CourseWare`), registered with `allCourseWare`
so a session can resolve view IDs. `default` holds the built-in fill-in card.

**Tag**: a label on cards, used as the course's vocabulary of skills and topics. Navigation
strategies act on tags; per-skill ratings are kept per tag.

**Tag role**: a convention in tag names (`exercise`, `expose`, `intro`) saying whether a response
grades that skill or only counts exposure. See [Pedagogy](./learn/pedagogy#tag-roles).

**Course**: a set of cards, tags, data-shape registrations, and navigation strategy documents, with
a `CourseConfig`.

**Inline component**: a Vue component placed inside markdown card text with
<code v-pre>{{ &lt;name /&gt; }}</code>.

## Learner model

**ELO**: a rating system borrowed from chess. Learners and cards both carry ratings; when a learner
answers a card, both move. "Dual-dynamic" means card difficulty is learned from responses too.

**Per-tag (per-skill) ELO**: a separate rating for each tag a card grades, for both learner and
card.

**Evidence buffer**: the last few first-attempt results a learner had on a tag, used to judge
whether a skill is secure, shaky, or unproven.

**Skill pressure**: how much a skill needs practice: the larger of how far it sits below the
learner's other skills and how insecure it is.

**SRS (spaced repetition)**: scheduling a card's next review at a growing interval after each
success, and resetting it after a failure.

**Evaluation**: a question's verdict on one response: `isCorrect`, `performance`, and optionally
`fluent` and `deferAdvance`.

**Performance**: a 0-1 score, or a per-tag map (`TaggedPerformance`) with a `_global` entry.

## Selection

**Content source**: anything that can supply scored cards to a session
(`StudyContentSource.getWeightedCards`). A course is one.

**Navigation strategy**: a stored document naming a generator or filter class and its config.

**Pipeline**: what a course runs to pick cards: generate, filter, drop zeros, regulate, apply hints,
diversity re-rank, select.

**Generator**: a pipeline stage that proposes candidate cards with initial scores (ELO, SRS,
prescribed).

**Filter**: a pipeline stage that multiplies scores. A **gate** filter means "not ready yet"; a
**signal** filter expresses preference.

**Regulator**: the pipeline stage that balances reviews against new cards, from review backlog and
time since new material.

**Weighted card**: a candidate card with a score and provenance.

**Provenance**: the per-card record of what each pipeline stage did to its score, and why.

**Hints** (`ReplanHints`): boost, require, or exclude cards or tags for one pipeline run, or for the
rest of a session (session hints).

**Strategy state**: per-learner, per-course data a strategy (or the app) stores under a key; the
same document can be read by a filter and written by app code.

**Learnable weight / orchestration**: a strategy weight varied across learners, meant to be tuned
from their outcomes. The tuning loop is not yet wired.

## Sessions

**Study session**: a time-boxed run of the study loop, rendered by `StudySession` and driven by
`SessionController`.

**Supply queue**: the session's ranked list of new cards and reviews, from the pipeline.

**Failed queue**: cards missed this session, to be cleared before it ends.

**Replan**: a re-run of the pipeline mid-session, to refill the supply queue or to act on hints.

**Hydration**: fetching a card's data and building its question and view, ready to render.

**Card record**: one response as stored in the learner's history: evaluation, answer, time spent.

## Deployment

**Data layer**: the interfaces through which everything reads and writes data, with a CouchDB
implementation and a static one. See [Data Layer](./learn/data-layer).

**Static course**: a course packed into JSON files (manifest, chunks, indices) and served without a
backend.

**`skuilder.json`**: a manifest naming which courses an app loads, or describing one course. See
[`skuilder.json`](./skuilder.json.md).

**Studio (mode)**: the local editing environment `skuilder studio` starts for a static course. See
[Adding Content](./do/studio-mode).

**Flush**: studio's save: write the edited course back to the static files.

**MCP**: Model Context Protocol; the interface through which an agent reads and edits a course. See
[Connect Agents](./do/mcp).
