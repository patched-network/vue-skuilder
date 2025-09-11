# Status Update: The skuilder.json Specification

This document summarizes the work done to define the `skuilder.json` specification, which governs how course content is declared and loaded by a `dataLayerProvider`.

### 1. Initial Ambition: A `package.json` for Content

The original vision, explored in early assessments, was to create a rich manifest for educational content, inspired by `package.json`. This manifest, tentatively named `quilt.json`, was conceived to support a complex ecosystem with:

- A formal "skill taxonomy" to classify content.
- Granular, skill-based dependency management (e.g., a course declaring it `provides` "modular arithmetic" and `requires` "basic division").
- Advanced metadata for adaptive learning.

This "blue sky" approach aimed for a highly composable and intelligent content ecosystem.

### 2. Pragmatic Evolution: The "Manifest of Manifests"

Through further analysis, the approach evolved into a more direct and immediately achievable solution: a "manifest of manifests." This pattern became the conceptual stepping stone for the current implementation. The core idea is that an application would have a single root manifest file that points to the individual manifests of each course it needs to load.

### 3. The Implemented MVP Spec: A Recursive Dependency Tree

This pragmatic approach led to the current, implemented specification for `skuilder.json`. This spec defines a recursive dependency tree that allows the application to load courses from multiple locations. It is defined by two types of manifests:

#### A. The Root (or Aggregator) Manifest

This file resides in the main application and declares its dependencies on various content packages.

- **Purpose:** To act as the single entry point for the data layer, listing all required courses.
- **Example (`docs/public/skuilder.json`):**
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

#### B. The Leaf (or Content) Manifest

This file resides within a self-contained course directory and defines it as a package.

- **Purpose:** To describe a specific content package and point to its actual content.
- **Example (within a course directory):**
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

### 4. Current Loading Mechanism: Runtime Resolution

The `dataLayerProvider` uses this specification as follows:

1.  It fetches the application's root `skuilder.json`.
2.  It parses the `dependencies` object.
3.  For each dependency, it recursively follows the URL to fetch the corresponding leaf `skuilder.json`.
4.  From the leaf manifest, it reads the `content.manifest` path to locate the final `manifest.json` file that describes the course's chunked data.

### 5. Summary of Accomplishments

The current `skuilder.json` specification successfully provides:

- A **standardized format** for declaring content packages and their dependencies.
- A mechanism for a **single application to aggregate courses** from multiple sources (local and remote).
- A **clear and predictable process** for a `dataLayerProvider` to discover and load course data.
- A **solid foundation** for future enhancements, such as a build-time dependency resolver that could generate a `skuilder.lock.json` for improved performance and deterministic loading.
