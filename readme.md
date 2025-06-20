![`platform-ui` E2E](https://github.com/patched-network/vue-skuilder/actions/workflows/e2e-tests.yml/badge.svg)
![`standalone-ui` E2E](https://github.com/patched-network/vue-skuilder/actions/workflows/standalone-e2e-tests.yml/badge.svg)
![CLI Regression](https://github.com/patched-network/vue-skuilder/actions/workflows/cli-regression-test.yml/badge.svg)

General tooling for interactive tutoring systems, with experimentation toward
- mass-collaborative authoring
- mixture-of-expert-systems guided learning
- self-healing courses via proactive surfacing of learning bottlenecks
- content inheritance between courses

Think: the FOSS lovechild of anki, duolingo, wikipedia, and MathAcadamy, with a more generalized surface area for the types of content and skills that can be exercised.

Aiming toward effective libraries and a main learner-loop to enable:
- a. independent authoring of individual courses
- b. community developed courses
- c. a platform to support both a. and b.

## Project Architecture

This monorepo contains three top-level system components:

- **Vue SPA Frontend** (`packages/platform-ui`): Vue 3 + Vuetify 3 progressive web app
- **Express API** (`packages/express`): Node.js backend API
- **CouchDB Database**: Storage layer with replication protocol support

Which are in turn built from the helper packages:

- `common`: some core logic and interfaces that define communication between project components
- `common-ui`: UI components useful in both a `platform` and standalone `course` context
- `courses`: logic and interfaces for both generic and domain specific courses.
- `db`: interfaces for the application's communication with the data later, and an implementation for CouchDB backend via PouchDB

## Development Quick Start

### Prerequisites

- Node.js 18+
- Yarn 4 (or corepack)
- Docker (for development database)

### Commands

```bash
git clone https://github.com/patched-network/vue-skuilder.git
cd vue-skuilder
git submodule update --init --recursive # a test-time database dump
yarn install
yarn dev
```

`dev` here:
- Builds packages
- Starts a local CouchDB instance in Docker with test data (http://localhost:5984)
- Launches the Express backend server (http://localhost:3000)
- Launches the Vue frontend (http://localhost:5173)

## Production Build

```bash
yarn build
```

This builds all packages and outputs the frontend as a static web app in the `packages/platform-ui/dist` folder and the backend in `packages/express/dist`.

## License

This project is licensed under:

- **AGPL-3.0** for the core platform: [License](https://opensource.org/licenses/AGPL-3.0)
- **MIT** for materials in the `courses` package: [License](https://opensource.org/licenses/MIT)
