# Adding Content with Studio Mode

A static course can't be edited through the app you deploy: there is no backend to write to.
**Studio mode** gives you one, temporarily. It loads your course into a local CouchDB, opens an
editor on it, and writes the result back to your project's static files when you say so.

```bash
npm run studio        # in a scaffolded project; same as `npx skuilder studio .`
```

## What it starts

| Service | Default port | Role |
|---|---|---|
| CouchDB (Docker) | 5985 | A scratch database holding your course while you edit |
| Express API | 3001 | Backend operations (course config, flush to static) |
| Studio UI | 7174 | The editor, opened in your browser |
| MCP server | (stdio) | Optional: lets an agent read and author the course |

The API and UI move to the next free port if theirs is taken; pick the CouchDB port with
`--port`. Stop studio with Ctrl-C, which shuts the services down.

## The workflow

1. **Load.** Studio reads `public/static-courses/<course-id>/` and unpacks it into the scratch
   CouchDB.
2. **Edit.** In the studio UI:
   - **Create card**: author one card at a time, for any registered card type.
   - **Bulk import**: paste many fill-in cards at once.
   - **Browse / course editor**: find, inspect and tag cards, and edit navigation strategies.
   - **Tags**: edit tag descriptions.
3. **Flush.** The save button packs the CouchDB course back into
   `public/static-courses/<course-id>/`, replacing the files there.
4. **Ship.** Commit the changed JSON, `npm run build`, deploy.

::: warning
Flushing **overwrites** the static course files. Commit (or back up) before a big editing
session, so you can diff and revert.
:::

## Your own card types in studio

If your project defines custom card types in `src/questions/`, studio includes them. On launch, the
CLI builds your question library, then builds the studio UI with it, and caches that build in
`.skuilder/studio-builds/` keyed by a hash of your questions. Change a question type and the next
`npm run studio` rebuilds. See [Creating Custom Cards](../extend/custom-cards).

## Authoring with an agent

Studio also prints an MCP server command and writes a `.mcp.json` file in the directory you
launched from, so an MCP-capable agent (for example Claude Code, started in the same directory) can
connect to the course you have open. The agent can list cards, shapes and tags, create and tag
cards, and add navigation strategies. Its edits land in the same scratch database, so they are
flushed (and reviewable in your diff) like any others. See [Connect Agents](./mcp).

## Editing a course that isn't a scaffolded project

Studio also accepts a course's `manifest.json` directly:

```bash
npx skuilder studio ./docs/public/static-courses/<course-id>/manifest.json
```

This is how you would edit a course embedded in another site, such as the demo course on this
docs site's frontpage.
