# CLI Reference

The `skuilder` command scaffolds course projects, runs the authoring studio, and moves course data
between CouchDB and static files.

## Installation

```bash
npm install -g @vue-skuilder/cli
# or run without installing:
npx @vue-skuilder/cli <command>
```

Scaffolded static projects also list the CLI as a dev dependency, so `npm run studio` works there
without a global install.

## Commands

### `init`

Scaffold a new course project (a copy of `standalone-ui`, configured).

```bash
skuilder init <project-name> [options]
```

**Arguments:**
- `project-name`: directory to create (required)

**Options:**
- `--data-layer <type>`: `static` or `dynamic` (default: `dynamic`)
- `--theme <name>`: `default`, `medical`, `educational`, or `corporate` (default: `default`)
- `--no-interactive`: skip the prompts and use the options given
- `--couchdb-url <url>`: CouchDB server URL (dynamic data layer)
- `--course-id <id>`: course to serve (dynamic data layer)
- `--import-course-data`: import course data from CouchDB into the project (static data layer)
- `--import-server-url <url>`: CouchDB server to import from
- `--import-username <username>`, `--import-password <password>`: credentials for that server
- `--import-course-ids <ids>`: comma-separated course IDs to import
- `--dangerously-clobber`: overwrite an existing directory

**Output:**
- A project directory with `package.json`, `vite.config.ts`, `tsconfig.json`, and
  `skuilder.config.json`
- For static projects: `public/skuilder.json` and a course under `public/static-courses/`, either
  imported or empty, plus a `studio` script
- Example custom card types in `src/questions/`

### `studio`

Launch a local course-editing environment: CouchDB, the Express API, the studio web editor, and an
MCP server for agents. See [Adding Content](./do/studio-mode).

```bash
skuilder studio [coursePath] [options]
```

**Arguments:**
- `coursePath`: a scaffolded project directory, or a course's `manifest.json` (default: `.`)

**Options:**
- `-p, --port <port>`: CouchDB port (default: `5985`)
- `--no-browser`: don't open a browser

**Services:**
- CouchDB in Docker (port 5985 by default) holding a scratch copy of the course
- Express API (from port 3001)
- Studio web interface (from port 7174)
- An MCP server command, and a `.mcp.json` written to the current directory

**Input types:**
- **Project directory**: a scaffolded project, with course data in `public/static-courses/`
- **Manifest file**: a course's `manifest.json`, next to its `chunks/` and `indices/`

**Workflow:**
1. Loads the course into CouchDB
2. Opens the web editor
3. The editor's save ("flush") writes the course back to the static files, replacing them

### `pack`

Pack a CouchDB course into static files for deployment.

```bash
skuilder pack <courseId> [options]
```

**Arguments:**
- `courseId`: course to pack (required)

**Options:**
- `-s, --server <url>`: CouchDB server URL (default: `http://localhost:5984`)
- `-u, --username <username>`, `-p, --password <password>`: CouchDB credentials
- `-o, --output <dir>`: output directory (default: `./static-courses`)
- `-c, --chunk-size <size>`: documents per chunk (default: `1000`)
- `--no-attachments`: leave out attachments (media)

**Output:**
- `manifest.json`: course config, chunk list, index list
- `chunks/`: course documents, grouped by type
- `indices/`: precomputed lookups (cards by ELO, tags by card, and the course's views)
- Media files, unless `--no-attachments`

### `unpack`

Load a static course directory into CouchDB for editing.

```bash
skuilder unpack <coursePath> [options]
```

**Arguments:**
- `coursePath`: static course directory (required)

**Options:**
- `-s, --server <url>`: CouchDB server URL (default: `http://localhost:5984`)
- `-u, --username <username>`, `-p, --password <password>`: CouchDB credentials
- `-d, --database <name>`: target database name (generated if not given)
- `--as <name>`: a new name for the unpacked course
- `--chunk-size <size>`: documents per batch (default: `100`)
- `--validate`: validate the migration
- `--cleanup-on-error`: delete the database if the migration fails

### `dump-user`

Write one learner's records for one course to a JSON file, for offline diagnosis (history,
scheduled reviews, ratings, session records, strategy state, and optionally the course cards they
touched). Requires CouchDB admin access.

```bash
skuilder dump-user <username> --course <courseId> [options]
```

**Arguments:**
- `username`: the learner whose user database to read (required)

**Options:**
- `-c, --course <courseId>`: course ID (required)
- `-s, --server <url>`: CouchDB base URL (default: `http://localhost:5984`)
- `--admin-user <name>`: CouchDB admin username (default: `admin`)
- `-p, --password <password>`: admin password (else `$COUCHDB_PASSWORD`, else `--password-file`)
- `--password-file <path>`: read the admin password from a file
- `--cards <scope>`: course cards to include: `touched`, `all`, or `none` (default: `touched`)
- `-o, --out <path>`: output file, or a directory for the default name (default: `.`)
- `--attachments`: inline user-DB attachments as base64

## Global Options

- `-h, --help`: display help
- `-V, --version`: display the version

## Requirements

- **Node.js** 22 (the build tooling needs at least 20.19)
- **Docker**, for studio mode
- **Git**, recommended: studio flushes overwrite course files, so commit before editing

## Examples

```bash
# Create a static course project
skuilder init my-anatomy-course --data-layer static --theme medical

# Launch studio for a project
skuilder studio ./my-course

# Launch studio for a course deployed inside another site
skuilder studio ./docs/public/static-courses/<course-id>/manifest.json

# Pack a course from CouchDB to static files
skuilder pack biology-101 --server http://localhost:5984 --username admin

# Unpack a static course into CouchDB for editing
skuilder unpack ./static-courses/biology-101 --validate

# Studio on a custom port, without a browser
skuilder studio . --port 6000 --no-browser
```

## Workflows

### Static course
1. `skuilder init my-course --data-layer static`
2. `npm run studio` (from the project): edit, then flush
3. Commit the changed course files; `npm run build`; deploy

### From a CouchDB course to static
1. `skuilder pack course-id`, or `skuilder init --import-course-data ...`
2. Deploy the static files with your app

### Static course back into CouchDB
1. `skuilder unpack ./static-course`
2. Edit on the CouchDB deployment
3. `skuilder pack course-id` to export again
