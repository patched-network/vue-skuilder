# What is Skuilder?

Briefly, `skuilder` is a set of [npm packages](https://npmjs.org/org/vue-skuilder) that provide:

- a modular, extensible architecture for interactive tutoring systems;
- application shells for a few contexts (a single static course, a multi-course platform, a
  local authoring studio);
- a CLI that scaffolds a course, runs the authoring studio, and moves course data between
  CouchDB and static files.

## ... *Why* is Skuilder?

To boldly go where no hierarchical SRS++ dev stack has gone before!

The overall vision is to simplify the production of top-tier interactive educational tech. To
this end, we have some broad goals.

### Improve accessibility and user onboarding

... to SRS applications by replacing complex config and
[canonical death spirals](https://www.lesswrong.com/posts/7Q7DPSk4iGFJd8DRk/an-opinionated-guide-to-using-anki-correctly)
with a simpler *goals* + *time commitment* configuration. We want our apps to immediately
maximize time-on-task for learners.

**Status**: ✅ Sessions are time-boxed. The learner says how long; the system decides what to
show, keeps a healthy backlog of reviews rather than racing it to zero, and clears missed cards
before the session ends.

### Encourage richer interaction

Second, we'd like to apply the paradigm to a __broader set of skills__ than has traditionally
been targeted. SRS is a proven paradigm for knowledge building, but we expect it can be taken from
'mere' retrieval into contexts with procedural and even creative aspects. The move is from a
knowledge-builder to a **sk**ill-b**uilder**.

**Status**: ✅ Card types are arbitrary Vue components. A card can grade a response on several
skills at once (for example, each letter of a spelled word), and can report speed separately from
correctness.

### Discover blended pedagogical models

We'd like to intelligently blend SRS with hierarchical knowledge graphs, dynamic difficulty
matching, and other tutoring interventions. This blending should be responsive to revealed
deficiencies in learner progress, and learning bottlenecks should surface automatically.

**Status**: core built, outer loop experimental.
- ✅ Dual-dynamic ELO: learner and card ratings co-evolve, globally and per skill (tag)
- ✅ A navigation pipeline: generators propose cards, filters gate or reweight them, and every
  card carries a record of why it was chosen
- ✅ Built-in strategies: prerequisites, interference avoidance, tag priority, skill pressure
  toward weak skills, prescribed curriculum targets
- ✅ Per-skill targeting: practice leans toward a learner's weakest and least settled skills
- 🟡 Evolutionary orchestration: strategy weights can be varied across learners, but the loop
  that records outcomes and tunes the weights is not yet wired into production sessions
- 🔜 Self-healing content, barrier detection

See [Pedagogy](./learn/pedagogy) for details.

### Create an open-source Curriculum Package Manager

We aim to specify a format to declare, package, and re-use educational content.

**Status**: 🟡 Design phase. A course can be packed to static files and loaded from any URL,
including another site's. A [`skuilder.json`](./skuilder.json.md) manifest names the courses an app
loads. Versions, dependency semantics, and cross-course prerequisites are not built.

## Tech Stack

Skuilder uses the following major dependencies:

- __TypeScript__ throughout
- __vue@3.x__ + __vite__: SPA frontends, reusable component libraries, and the build process
- __vuetify@3.x__: material-ui component library and theming engine
- __Apache CouchDB__ as the server-side database, and `pouchdb` as the client interface (also used
  for browser-local learner data)
- __express__: the backend API for platform and studio deployments
- __yarn workspaces__: monorepo management

## This site

This is developer documentation, mainly intended for persons interested in building their own SRS / adaptive tutoring system.

### Organization

The __Learn__ section explains the architecture and its parts.

The __Do__ section is a guided tutorial. Open it side-by-side with your terminal, IDE, or point an agent at it.

The __Extend__ section covers the main extension points: inline components, custom card types,
and navigation strategies (consumer defined pedagogy / learning protocols).

The __Reference__ section has the CLI, the default card syntax, the `skuilder.json` manifest, and
a glossary.

### Caveat and Working Assumption

This documentation is both *in-progress* and not intended to be fully comprehensive.

The project's modular components require a little cajoling to work together in different contexts
(eg, static-site vs live backend, standalone course vs course development platform). The tutorial
focuses on **standalone** courses built for **static deployment** with browser-local user data, as
described in the [quickstart](./do/quickstart).

General information should be reliable, but specifics like "`foo` must be exported from `bar`" may
apply only to the assumed context.

## Contributing

External collaboration welcome. First and foremost, run the [quickstart](./do/quickstart) and raise
[issues](https://github.com/patched-network/vue-skuilder/issues) wherever you stub your toes.

Small PRs that present as unambiguous wins are always welcome. Before working on a major PR,
consider raising the work as a github issue or being in touch through
[this contact form](https://patched.network/contact/).
