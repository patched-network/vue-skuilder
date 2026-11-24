# Quickstart

This page creates a new, empty `skuilder` course with the Skuilder CLI. The pages that follow
show how to populate and customize it.

## Prerequisites

- Node.js 22 (CI uses 22; the build tooling needs at least 20.19)
- npm or yarn
- Docker, for [studio mode](./studio-mode), which runs a temporary CouchDB

## Init

The `skuilder` CLI contains a setup wizard. In the commands below, replace `mycourse` with the
name of the directory you'd like your project created in.

```bash
npx @vue-skuilder/cli init mycourse
# or,
# npm install -g @vue-skuilder/cli
# skuilder init mycourse
```

The answers below create the simplest working course, with no reliance on existing
infrastructure. __NOTE__: the rest of the **Do** tutorial presumes you've taken this path.

```bash
? Course title:
My Course Title

? Data layer type:
Static (Self-contained JSON files)

? Would you like to import course data from a CouchDB server?
No

? Select theme:
(Your choice; see the Themes page for changing it later)
```

The same thing, non-interactively:

```bash
npx @vue-skuilder/cli init mycourse --data-layer static --no-interactive
```

Init takes about a minute. The `npm warn deprecated` lines it prints along the way are expected.

You now have a standalone static site as a new npm package. It stores learner data locally in the
browser (one learner per browser), and serves course content from JSON files bundled with the
webapp.

## What you got

```
mycourse/
├── skuilder.config.json         # title, course ID, data-layer type, theme
├── public/
│   ├── skuilder.json            # root manifest: which courses this app loads
│   └── static-courses/<id>/     # your (empty) course: manifest, chunks/, indices/
└── src/
    ├── main.ts                  # data-layer init, card-type registration
    └── questions/               # example custom card types; add your own here
```

## Build & Serve

To run your app:

```bash
cd mycourse
npm install
npm run dev
```

`npm install` takes a couple of minutes and ends with an `npm audit` count of moderate and high
vulnerabilities. These come from the scaffold's dependency tree, and you don't need to act on
them to follow this tutorial.

`npm run dev` prints a local URL, normally `http://localhost:5173/`. Vite picks the next free
port if that one is taken, so use the URL it prints. Ctrl-C stops it.

The app loads, but there is nothing to study yet. Your app has no content, and because it is statically hosted, you
cannot add to it through the 'front door' of the served application. Do not fear: the scaffolded
app includes a script for just this purpose.

```json {9}
"scripts": {
  "dev": "vite",
  "build": "npm run build:webapp && npm run build:lib",
  "build:webapp": "vite build",
  "build:lib": "BUILD_MODE=library vite build",
  "preview": "vite preview",
  "test:e2e": "cypress open",
  "test:e2e:headless": "cypress run",
  "studio": "skuilder studio"
},
```

`npm run studio` opens an editor for the course. It runs on its own (its own servers and ports),
so you don't need `npm run dev` running alongside it. Onward to [Adding Content](./studio-mode)!

`npm run build` produces two things: the deployable webapp in `dist/`, and a library build of
your custom card types in `dist-lib/` (`build:lib`), which studio mode uses so you can author
cards of those types. Studio runs `build:lib` itself, so you only need `npm run build` to deploy.
`npm run preview` serves the built `dist/` locally, to check it before you deploy.

The build takes a couple of minutes and is CPU-heavy. Warnings about `eval` in
`@vue-skuilder/db` during the build are expected.
