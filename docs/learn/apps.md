---
title: Application Types
---

# Application Types

Skuilder's modular architecture supports several deployment patterns. This page provides an overview of the available application shells.

## Standalone UI

The primary consumer application. This is what the [skuilder CLI](../cli) scaffolds and what the [dev quickstart](../do/quickstart) walks through.

**Features:**
- Single-course deployment
- Flexible data layer options:
  - **Static**: No backend — browser-local user data (IndexedDB), bundled course content
  - **Dynamic**: CouchDB backend with user login and cross-device sync
  - **Hybrid**: Mix static course content with dynamic user accounts
- Static deployment (CDN, GitHub Pages, Netlify, etc.) or server-hosted
- Offline-capable after initial load
- Full support for default card types and custom extensions

**Use when**: Building and distributing a course. This is the default path for most users.

**Package**: `@vue-skuilder/standalone-ui`

## Platform UI

::: warning Experimental
Platform UI is under active development. APIs and features may change.
:::

A multi-course platform shell aimed at:

- Course aggregation and discovery
- Community authoring tools
- User accounts and authentication
- Cross-device sync via CouchDB backend
- Progress tracking across multiple courses

Think of it as a wrapper that hosts multiple standalone courses with shared user infrastructure.

**Use when**: Building a learning platform, SaaS product, or community resource that aggregates multiple courses.

**Package**: `@vue-skuilder/platform-ui`

## Tuilder

::: danger Feature Incomplete
Tuilder is a proof-of-concept. It lacks core functionality and is not suitable for study sessions.
:::

A terminal-based interface experiment. Currently supports:

- User authentication
- Course metadata inspection
- Basic navigation

**Does not support:**
- Rendering default skuilder cards
- Study sessions
- Most card interactions

**Use when**: You're curious about TUI possibilities or want to contribute to its development.

**Package**: `@vue-skuilder/tuilder`

## Choosing an Application Type

For most use cases, **start with Standalone UI**. It's the most complete, best documented, and what the CLI tooling targets.

| Consideration | Standalone UI | Platform UI | Tuilder |
|--------------|---------------|-------------|---------|
| Recommended | ✅ Yes | Experimental | No |
| Backend required | Optional | Yes (CouchDB) | No |
| User accounts | Optional | Yes | Yes |
| Study sessions | ✅ Full | ✅ Full | ❌ None |
| Default cards | ✅ Full | ✅ Full | ❌ None |
| Static deployment | ✅ Yes | No | N/A |
| Dynamic backend | ✅ Yes | ✅ Yes | Partial |

## Building Your Own

The application packages consume shared libraries:

- `@vue-skuilder/common-ui` — Reusable Vue components (StudySession, card renderers, etc.)
- `@vue-skuilder/courseware` — Course content bundling and loading
- `@vue-skuilder/db` — Data layer abstractions

You can build a custom application by:

1. Selecting a data layer implementation (`couch` or `static`)
2. Composing UI components from `common-ui`
3. Integrating with your own navigation, authentication, and chrome

See the [quickstart](../do/quickstart) for a guided example using Standalone UI as a starting point.