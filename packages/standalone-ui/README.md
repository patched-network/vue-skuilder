# Standalone UI Package

A template interface for single-course Skuilder applications.

Contrasting against `platform-ui`, this package:

- Focuses on delivering a specific, scoped curriculum
- Provides simplified navigation and course-specific theming

Within the monorepo, this package acts as a blueprint for the scaffolding tool while providing a reference implementation.

When courses are generated via the Skuilder CLI, this template transforms into customized, independent applications.

## Core Dependencies

Vue 3, Vuetify 3

## Development

The existing `./skuilder.config.js` file contains a devenv config that loads an `anatomy` course from the existing test DB docker image.

Before `yarn dev` of the standalone package, the testDB docker image must be loaded via `yarn couchdb:start` in project root.
