---
title: Application Types
---

# Application Types

Skuilder's packages are libraries first. A few application shells assemble them for common
situations. This page describes each shell and when to use it.

## Standalone UI

The primary consumer application, and what the [skuilder CLI](../cli) scaffolds and the
[dev quickstart](../do/quickstart) walks through.

**Features:**
- Single-course deployment
- Two data-layer modes, chosen in `skuilder.config.json`:
  - **Static**: no backend. Course content is bundled as JSON; learner data stays in the browser
    (IndexedDB).
  - **Dynamic**: a CouchDB backend, with user accounts and cross-device sync.
- Static deployment (CDN, GitHub Pages, Netlify, etc.) or server-hosted
- Offline-capable after the initial load
- Full support for the default card type and your own card types, registered in `src/questions/`
- In static mode, an `npm run studio` script for editing content (see
  [Adding Content](../do/studio-mode))

**Use when**: building and distributing a course. This is the default path for most users.

**Package**: `@vue-skuilder/standalone-ui` (copied into your project by `skuilder init`)

## Studio UI

The authoring interface that `skuilder studio` launches against a local, temporary CouchDB. It
offers a course browser, a card editor, bulk import, and tag editing, and a button that writes the
edited course back to your project's static files. The CLI builds it with your project's custom card
types included, so they can be authored and previewed too.

**Use when**: adding or editing content for a static course. You don't run it directly.

**Package**: `@vue-skuilder/studio-ui` (embedded in `@vue-skuilder/cli`)

## Platform UI

::: warning Experimental
Platform UI is under active development. APIs and features may change.
:::

A multi-course platform shell with:

- user accounts and authentication;
- course creation, a card editor, tagging, and navigation-strategy editors;
- course discovery and registration;
- classrooms;
- cross-device sync via the CouchDB backend, with the `express` API for privileged operations.

Think of it as a host for many courses with shared user infrastructure.

**Use when**: building a learning platform, SaaS product, or community resource that aggregates
multiple courses.

**Package**: `@vue-skuilder/platform-ui`, with `@vue-skuilder/express` as its backend

## Tuilder

::: danger Feature Incomplete
Tuilder is a proof-of-concept and is not maintained alongside the other packages.
:::

A terminal interface built with Ink. It can log in, configure a session, and step through
text-shaped cards (fill-in and multiple choice). It does not write card records, so a session in
the TUI moves no ratings and schedules no reviews.

Its value is as evidence: it drives the real `SessionController` from Node, with no Vue and no
DOM, which shows that scheduling and selection don't depend on the browser.

**Use when**: you're curious about non-Vue clients or want to contribute to one.

**Package**: `@vue-skuilder/tuilder`

## Choosing an Application Type

For most use cases, **start with Standalone UI**. It's the most complete, best documented, and what
the CLI targets.

| Consideration | Standalone UI | Platform UI | Tuilder |
|--------------|---------------|-------------|---------|
| Recommended | ✅ Yes | Experimental | No |
| Backend required | Optional | Yes (CouchDB + express) | Yes (CouchDB) |
| User accounts | Dynamic mode only | Yes | Yes |
| Study sessions | ✅ Full | ✅ Full | Viewing only |
| Custom card types | ✅ Yes | ✅ Yes | ❌ No |
| Static deployment | ✅ Yes | No | N/A |

## Building Your Own

The application packages are thin. They consume shared libraries:

- `@vue-skuilder/db`: data layer, navigation pipeline, `SessionController` (no Vue)
- `@vue-skuilder/common-ui`: reusable Vue components (`StudySession`, card rendering, auth UI)
- `@vue-skuilder/courseware`: the card-type registry and built-in card types
- `@vue-skuilder/common`: shared types

You can build a custom application by:

1. choosing a data layer (`couch` or `static`) and calling `initializeDataLayer()`;
2. registering the card types your content uses with `allCourseWare`;
3. rendering `StudySession` with your content sources, inside your own navigation, auth, and
   chrome.

This docs site is itself an example: the frontpage demo is `StudySession` on a static data layer,
mounted inside VitePress (see `docs/.vitepress/theme/components/EmbeddedCourse.vue`).

See the [quickstart](../do/quickstart) for a guided example using Standalone UI as a starting point.
