![`platform-ui` E2E](https://github.com/patched-network/vue-skuilder/actions/workflows/e2e-tests.yml/badge.svg)
![`standalone-ui` E2E](https://github.com/patched-network/vue-skuilder/actions/workflows/standalone-e2e-tests.yml/badge.svg)
![CLI Regression](https://github.com/patched-network/vue-skuilder/actions/workflows/cli-regression-test.yml/badge.svg)

Modular toolkit for the construction of interactive tutoring systems, with experimentation toward
- mass-collaborative authoring
- mixture-of-expert-systems guided learning
- self-healing courses via proactive surfacing of learning bottlenecks
- schema definition to share content between courses, e.g., a package manager for curricula
- MCP hooks for LLMs to responsibly generate structured content according to structured demand; slop on rails

Think: the FOSS lovechild of Anki, Duolingo, Wikipedia, and MathAcademy, with a more generalized surface area for the types of content and skills that can be exercised.

## Quick Start

### For Course Creators (building *with* `vue-skuilder`) (start here!)

Install the Skuilder CLI to create your first course:

```bash
npm install -g skuilder # npx ok too!
skuilder init my-course --data-layer=static
cd my-course
npm run dev # serve your course locally
npm run studio # edit your course content via web UI
```

### For Platform Developers / Contributors (building `vue-skuilder` itself)

Clone and develop the full platform:

```bash
git clone https://github.com/patched-network/vue-skuilder.git
cd vue-skuilder
yarn install
yarn setup # makes git submodule available - test database
yarn dev # runs platform-ui, express API, and CouchDB
```

## Project Architecture

This monorepo is structured to support both **platform development** and **course creation**.

Broadly: an education system has `User` and `Content` as endpoints, with `UI` as the mediating software in between.

Here:

### User

The only user abstraction in the project is the `UserDBInterface`, which lives in the `@vue-skuilder/db` package. It's powered by PouchDB, which stores data locally in the case of static courses, or syncs with a CouchDB backend in dynamic / platform deployments.

### Content

Again, contained in the `db` package. Content is served over a core interface:

```
interface StudyContentSource {
  getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;
  getNewCards(n?: number): Promise<StudySessionNewItem[]>;
}
```

Various implementations satisfy this interface, but the important distinction is that content can be either **static** (JSON files) or **dynamic** (CouchDB database). The `db` package contains converters to transform courses between these form factors as well, enabling, e.g., checkpointing and portable deployment of a 'live' course.

### UI

There are several UI *application* packages:
- `standalone-ui`: a skeleton static SPA for rendering a course. The thing that you'd deploy as user-facing.
- `studio-ui`: a focused content editor for individual courses, usable against either static or dynamic courses.
- `platform-ui`: ⚠️functional wip⚠️ a static SPA for managing many users and courses, allowing, e.g., multi-course study sessions, user course creation, classrooms (teacher-led cohorts). NB: the site itself is static, but it connects to a dynamic backend API and CouchDB database.
- `tuilder`: ⚠️**non**-functional wip⚠️ a tui for consuming courses in the terminal

And some shared UI packages:
- `common-ui`: a library of reusable Vue components and utilities
- `courses`: a package containing domain-specific course logic and content types, also base-types for course content rendering components (e.g., a Chessboard component for a chess course)
- `edit-ui`: course editing widgets used in both `studio-ui` and `platform-ui`

All web UI is built with Vue 3 and Vuetify 3, in TypeScript, mostly with Composition API and Pinia state management. All web UI shares most of its config via `./vite.config.base.json`

### Glue

The `express` backend API server is responsible, in dynamic-data contexts, for:
- post-processing media content
- enforcing correct metadata in course databases
- handling various user requests
- and probably other stuff as well!

The `common` package contains some core logic and interfaces that define communication between components.

### Utility

The `cli` package (published on npm as `skuilder`) gives commands to create, manage, or migrate courses. See [packages/cli/README.md](packages/cli/README.md) for more details.

## 🤝 Contributing

Please do:
- kick tires
- file issues (bugs)
- file issues (questions)
- file issues (feature requests, roadmap / vision discussions)
- open smallish PRs that present as clear wins, even without prior discussion

Probably don't:
- open large PRs without prior discussion

## 📄 License

This project is licensed under:

- **AGPL-3.0** for the core platform: [License](https://opensource.org/licenses/AGPL-3.0)
- **MIT** for materials in the `courses` package: [License](https://opensource.org/licenses/MIT)
