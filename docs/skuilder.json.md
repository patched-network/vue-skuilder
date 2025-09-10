
# `skuilder.json` Manifest (WIP)

The `skuilder.json` file is a declarative manifest used to define a Skuilder project or a composable content package (a "quilt"). It is inspired by `package.json` from the Node.js ecosystem, allowing content to be managed as packages with their own metadata and dependencies.

## Current Usage (MVP)

In the current implementation, `skuilder.json` enables the documentation site to load multiple courses from different locations using a runtime resolution strategy.

There are two primary ways this file is used:

### 1. Root Manifest (Aggregator)

An application (like this docs site) has a root `skuilder.json` file that declares its content dependencies. The `dependencies` field maps a package name to the URL of its own `skuilder.json`.

**Example: `/public/skuilder.json`**

```json
{
  "name": "@skuilder/docs-site",
  "version": "0.1.0",
  "description": "The root manifest for the vue-skuilder documentation site.",
  "dependencies": {
    "@skuilder/hero-course": "/vue-skuilder/static-courses/2aeb8315ef78f3e89ca386992d00825b/skuilder.json",
    "@skuilder/example-course-1": "https://patched-network.github.io/example-course-1/skuilder.json"
  }
}
```

### 2. Leaf Manifest (Content Package)

A self-contained course (a "leaf" package) has its own `skuilder.json` that defines its metadata and points to its content manifest.

**Example: A `skuilder.json` within a course directory**

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

At runtime, the data layer starts by fetching the root manifest, then recursively fetches the manifest for each dependency to discover the location of the actual course content.

## Roadmap

This runtime resolution is the first step. The long-term vision is to create a more robust system analogous to modern package managers.

-   **Build-Time Dependency Resolution:** A CLI command (e.g., `skuilder install`) will be introduced. This tool will read the root `skuilder.json` and resolve the entire dependency graph ahead of time.

-   **Lock File Generation:** The resolution step will produce a `skuilder.lock.json` file. This file will contain a flat, deterministic list of all required course manifests and their absolute URLs. The runtime data layer will consume this simple lock file directly, resulting in faster and more reliable startup.

-   **Registry Support:** Eventually, the system will support version-based dependencies (e.g., `"@skuilder/math-basics": "^1.2.0"`) which will be resolved against a central or private Skuilder package registry.
