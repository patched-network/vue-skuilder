# `skuilder.json` Manifest (WIP)

The `skuilder.json` file is a declarative manifest for a Skuilder app or a course package. It is
modeled on `package.json`, with the intent that courses can eventually be managed as packages with
their own metadata and dependencies. Today it does one job: it tells a static deployment which
courses to load, and where from.

## Current Usage

The static data layer reads a root `skuilder.json`, then fetches each course it lists. A scaffolded
static project (`skuilder init --data-layer static`) and this docs site both work this way.

### 1. Root manifest (the app)

The app's root `skuilder.json` declares its content dependencies. `dependencies` maps a package
name to the URL of that course's own `skuilder.json`. URLs may be relative to the root manifest or
absolute, including another origin.

**Example: this site's `/public/skuilder.json`**

```json
{
  "name": "@skuilder/docs-site",
  "version": "0.1.0",
  "description": "The root manifest for the vue-skuilder documentation site.",
  "dependencies": {
    "@skuilder/hero-course": "/vue-skuilder/static-courses/2aeb8315ef78f3e89ca386992d00825b/skuilder.json",
    "@skuilder/demo-chess": "https://patched-network.github.io/demo-chess/static-courses/demo-chess/skuilder.json"
  }
}
```

### 2. Leaf manifest (a course)

A course has its own `skuilder.json` that names it and points to its content manifest (the
`manifest.json` that `skuilder pack` writes).

```json
{
  "name": "@skuilder/hero-course",
  "version": "1.0.0",
  "description": "The interactive course used in the VitePress hero section.",
  "content": {
    "type": "static",
    "manifest": "./manifest.json"
  }
}
```

### Resolution

At startup the static data layer:

1. reads the root manifest's `dependencies`;
2. fetches each course's `skuilder.json`, then its content manifest;
3. registers the course under its course ID, and also under its dependency name. Either can be
   used as a content source ID, so `StudySession` can be given `@skuilder/hero-course`.

Resolution is **one level deep**. A course's own `dependencies` are not followed, versions are not
interpreted, and a course that fails to load is logged and skipped.

## Roadmap

The runtime resolution is a first step. The longer-term direction:

- **Build-time resolution**: a CLI command (e.g., `skuilder install`) resolves the whole dependency
  graph ahead of time into a lock file (`skuilder.lock.json`): a flat, deterministic list of course
  manifests and their URLs, which the runtime reads directly.
- **Versioned dependencies**: ranges like `"@skuilder/math-basics": "^1.2.0"`, likely resolved
  through npm itself rather than a new registry.
- **Dependencies with meaning**: today a dependency means "also load this course". The intent is
  for a course to depend on an *outcome* another course provides ("this learner can do single-digit
  addition"), so that one course can gate on, or send a learner to, another. This needs a stable
  identity for courses and their skills across versions, which is the hard part: a learner's
  history is keyed to a course version's cards and tags, so upgrading a course is a migration of
  learner state, not just a file swap.
