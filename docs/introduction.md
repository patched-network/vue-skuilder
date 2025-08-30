
# What is Skuilder?

Briefly, `skuilder` is a set of [npm packages](https://npmjs.org/org/vue-skuilder) that provide:
- a modular and extensible architecture for interactive tutoring systems
- skeleton implementations suitable for a variety of contexts (eg: community platform, SaaS, static deployments)
- a cli to help tie things together and scaffold applications

## ... *Why* is Skuilder?

To boldly go where no heirarchical SRS++ dev stack has gone before!

The overall vision is to simplify the production of top-tier interactive educational tech, and for this simplification to catylise increased participation and innovation. To this end, we have some broad goals:

__First__, we want to __improve accessibility and user onboarding__ by replacing complex config and [canonical death spirals](https://www.lesswrong.com/posts/7Q7DPSk4iGFJd8DRk/an-opinionated-guide-to-using-anki-correctly) with simpler *goals* + *time commitment* configuration. We want our apps to immediately maximize time-on-task for learners.

This work is *complete-ish*.

__Second__, we'd like to apply the paradigm to a __broader set of skills__ than has traditionally been targeted. SRS is a proven paradigm for knowledge building, but we expect it can be taken from 'mere' retrieval into contexts with procedural and even creative aspects. The move is from a knowledge-builder to a **sk**ill-b**uilder**.

This work is *complete-ish*.

__Third__, we'd like to intelligently blend the SRS paradigm with heirarchical knowledge graphs, dynamic high-demensional dificulty sorting, and other bespoke tutoring intervtions. We'd like this blending to be responsive to revealed deficiencies in userbase progress through course materials, and we'd like these learning bottlenecks to be surfaced automaticlly. Further, we're interested in generalized A/B or marketplace mechanisms for pedagogical strategies over given curricula.

This work is *in progress*, with a dynamic high-dimensional difficuty sorting default pedagogy, and existing API definitions and data storage hooks for custom "ContentNavigationStrategies".

__Finally__, we aim to specify a format to declare, package, and re-use educational content.

This work is *in design phase*, but will lean on existing mechanisms for declaring contents of serialized courses.

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

The __Learn__ section

The __Do__ section is a guided tutorial that . Open it side-by-side with your terminal, IDE, or claude-code(-clone).

<!--The __Reference__ section leans into the nitty-gritty details. You can probably leave it alone until either:
- you're
--->

### Caveat and Working Assumption

This documentation is both *in-progess* and also not really intended to be fully comprehensive.

The project's modular components require a little cajoling to work together in different contexts (eg, static-site vs live backend, standalone course vs course development platform). This site focuses on **standalone** courses built for **static deployment** and browser-local user data, as described in the [quickstart](./quickstart) document.

All "general purpose" information should be reliable, but specifics in the vein of "`foo` must be exported from `bar`" may apply to the specific assumed context.

## Contributing

External collaboration welcome. First and foremost, run the [quickstart](./quickstart) and raise [issues](https://github.com/patched-network/vue-skuilder/issues) wheverver you stub your toes.

Small PRs that present as unambiguous wins are always welcome. Before working on a major PR, consider raising the work as a github issue or being in touch through [this contact form](https://patched.network/contact/).
