
# What is Skuilder?

Briefly, `skuilder` is a set of [npm packages](https://npmjs.org/org/vue-skuilder) that provide:
- a modular and extensible architecture for interactive tutoring systems
- skeleton implementations suitable for a variety of contexts (eg: community platform, SaaS, static deployments)
- a cli to help tie things together and scaffold applications

## ... *Why* is Skuilder?

To build on the legacy of great open-source personalized learning software like [Anki](https://apps.ankiweb.net/?download)! With [SRS](https://en.wikipedia.org/wiki/Spaced_repetition), Anki made **remembering things** into a personal choice - this is magical! - but the family of similar software has been slow to penerate into the mainstream.

We hope to move this needle a little by various means:

### SRS++

First, we'd like to have **friendlier end-user experiences** by default. Traditional SRS implementations both require a substantial self-education onboarding, and the user experience is famously brittle against interruptions to a user's regular study regimine.

Second, we're broadening the scope from pure 'knowledge' retrieval to become a more general purpose **sk**ill-b**uild**ing engine. This involves both **richer interactive experiences** with [individual cards](/custom-cards), and also moving [beyond](/pedagogy) pure SRS protocols for navigating course content.

Third, we hope that with flexible and friendly tooling, more people can fruitfully experiment in the space, bringing effective techniques like SRS, interleaving, and knowledge graphs to their own pet domains.

### And Beyond

We're also

## Tech Stack

Skuilder uses the following major dependencies:

- __vue@3.x__ + __vite__ - for SPA frontend, reusable component libraries, and build process
- __vuetify@3.x__ - material-ui component library and theming engine
- __Apache CouchDB__ as server-side database, and `pouchdb` as a client interface
- __express__ as backend in
- __yarn workspaces__ - for monorepo management

## This site

This is developer documentation, mainly intended for persons interested in building their own SRS / adaptive tutoring system.

### Caveat and Working Assumption

This documentation is both *in-progess* and also not really intended to be fully comprehensive.

The project's modular components require a little cajoling to work together in different contexts (eg, static-site vs live backend, standalone course vs course development platform). This site focuses on **standalone** courses built for **static deployment** and browser-local user data, as described in the [quickstart](./quickstart) document.

All "general purpose" information should be reliable, but specifics in the vein of "`foo` must be exported from `bar`" may apply to the specific assumed context.


## Contributing

External collaboration welcome. First and foremost, run the [quickstart](./quickstart) and raise [issues](https://github.com/patched-network/vue-skuilder/issues) wheverver you stub your toes.

Small PRs that present as unambiguous wins are always welcome. Before working on a major PR, consider raising the work as a github issue or being in touch through [this contact form](https://patched.network/contact/).
