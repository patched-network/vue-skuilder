---
section: workflow
title: Building a course
pages: do/quickstart, do/studio-mode, do/theming, cli, learn/apps
---

## intro workflow-intro

**The static-course workflow:**

1. `npx @vue-skuilder/cli init mycourse --data-layer static`: a standalone app for one course.
2. `npm run studio`: a scratch CouchDB, an editor, and an MCP server, on your machine.
3. **Flush** in the editor: the course is written back to your project's static files.
4. Commit, `npm run build`, deploy anywhere static.

Custom card types in `src/questions/` are built into the studio editor too. For many courses
with shared accounts, there is `platform-ui` with the `express` backend.

[Read: Quickstart](/vue-skuilder/do/quickstart.html)

## card wf-init elo=1000

`skuilder init mycourse --data-layer static` scaffolds {{a standalone app for one course||a multi-course platform|a CouchDB server}}.

## card wf-why-studio elo=1040

A static course is edited in studio mode because the deployed app {{has no backend to write to||has no markdown renderer}}.

## card wf-flush elo=1060

In studio, flushing {{writes the course back to your static files, replacing them||publishes the course to npm|syncs your edits to other learners}}.

## card wf-commit elo=1020

Because a flush overwrites course files, the recommended habit is to {{commit before an editing session||keep the course out of git}}.

## card wf-custom-in-studio elo=1100

Custom card types in `src/questions/` are {{built into the studio editor||ignored by studio until deployed}}, so you can author cards of those types.

## card wf-platform elo=1080

For many courses with shared accounts and classrooms, the shell is {{platform-ui, with the express backend||standalone-ui|tuilder}}.

## card wf-pack elo=1120

`skuilder pack` turns {{a CouchDB course into static files||a static course into a CouchDB database}}.
