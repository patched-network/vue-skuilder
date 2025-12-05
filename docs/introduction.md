
# What is Skuilder?

Briefly, `skuilder` is a set of [npm packages](https://npmjs.org/org/vue-skuilder) that provide:
- a modular and extensible architecture for interactive tutoring systems
- skeleton implementations suitable for a variety of contexts (eg: community platform, SaaS, static deployments)
- a CLI to help tie things together and scaffold applications

## ... *Why* is Skuilder?

To boldly go where no heirarchical SRS++ dev stack has gone before!

The overall vision is to simplify the production of top-tier interactive educational tech. To this end, we have some broad goals:

### Improve accessibility and user onboarding

... to SRS applications by replacing complex config and [canonical death spirals](https://www.lesswrong.com/posts/7Q7DPSk4iGFJd8DRk/an-opinionated-guide-to-using-anki-correctly) with simpler *goals* + *time commitment* configuration. We want our apps to immediately maximize time-on-task for learners.

**Status**: ✅ Core session management and time-based study flow implemented.

### Encourage richer interaction

Second, we'd like to apply the paradigm to a __broader set of skills__ than has traditionally been targeted. SRS is a proven paradigm for knowledge building, but we expect it can be taken from 'mere' retrieval into contexts with procedural and even creative aspects. The move is from a knowledge-builder to a **sk**ill-b**uilder**.

**Status**: ✅ Extensible card system supports custom question types, multi-dimensional performance evaluation, and compositional skill hierarchies.

### Discover blended pedagogical models

We'd like to intelligently blend SRS with hierarchical knowledge graphs, dynamic difficulty matching, and other tutoring interventions. This blending should be responsive to revealed deficiencies in learner progress, and learning bottlenecks should surface automatically.

**Status**: 🟡 In progress.
- ✅ Dual-dynamic ELO system (user + card ratings co-evolve)
- ✅ Configurable navigation strategies (prerequisites, interference avoidance, priority ordering)
- ✅ Visual authoring UI for strategy configuration
- 🔜 Per-tag skill targeting, strategy composition, evolutionary orchestration

See the [Pedagogy System](./learn/pedagogy) doc for details.

### Create an open-source Curriculum Package Manager

We aim to specify a format to declare, package, and re-use educational content.

**Status**: 🟡 Design phase. Static course bundling works today; package management semantics are in development.

## Tech Stack

Skuilder uses the following major dependencies:

- __vue@3.x__ + __vite__ - for SPA frontend, reusable component libraries, and build process
- __vuetify@3.x__ - material-ui component library and theming engine
- __Apache CouchDB__ as server-side database, and `pouchdb` as a client interface
- __express__ as backend in
- __yarn workspaces__ - for monorepo management

## This site

This is developer documentation, mainly intended for persons interested in building their own SRS / adaptive tutoring system.

### Organization

The __Learn__ section provides conceptual background on the architecture and its components.

The __Do__ section is a guided tutorial. Open it side-by-side with your terminal, IDE, or claude-code.

### Caveat and Working Assumption

This documentation is both *in-progress* and not intended to be fully comprehensive.

The project's modular components require a little cajoling to work together in different contexts (eg, static-site vs live backend, standalone course vs course development platform). This site focuses on **standalone** courses built for **static deployment** and browser-local user data, as described in the [quickstart](./do/quickstart) document.

General information should be reliable, but specifics like "`foo` must be exported from `bar`" may apply only to the assumed context.

## Contributing

External collaboration welcome. First and foremost, run the [quickstart](./do/quickstart) and raise [issues](https://github.com/patched-network/vue-skuilder/issues) wherever you stub your toes.

Small PRs that present as unambiguous wins are always welcome. Before working on a major PR, consider raising the work as a github issue or being in touch through [this contact form](https://patched.network/contact/).
