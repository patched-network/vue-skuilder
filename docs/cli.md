# CLI Reference

Course development and management command-line interface.

## Installation

```bash
npm install -g @vue-skuilder/cli
```

## Commands

### `init`

Scaffold new course project with Vue-Skuilder structure.

```bash
skuilder init <project-name> [options]
```

**Arguments:**
- `project-name` - Name of the project to create (required)

**Options:**
- `--data-layer <type>` - Data layer type: static or dynamic (default: dynamic)
- `--theme <name>` - Theme: default, medical, educational, or corporate (default: default)
- `--no-interactive` - Skip interactive prompts
- `--couchdb-url <url>` - CouchDB server URL (for dynamic data layer)
- `--course-id <id>` - Course ID to import (for dynamic data layer)
- `--import-course-data` - Import course data from CouchDB (for static data layer)
- `--import-server-url <url>` - CouchDB server URL for course import
- `--import-username <username>` - Username for course import server
- `--import-password <password>` - Password for course import server

**Output:**
- Creates course directory structure
- Generates configuration files (package.json, vite.config.ts, tsconfig.json)
- Installs dependencies
- Optionally imports course data from CouchDB

### `studio`

Launch complete course editing environment with CouchDB, Express API, and web interface.

```bash
skuilder studio [coursePath] [options]
```

**Arguments:**
- `coursePath` - Path to course directory or manifest.json file (default: '.')

**Options:**
- `-p, --port <port>` - CouchDB port (default: 5985)
- `--no-browser` - Skip automatic browser launch

**Services:**
- CouchDB instance (Docker) for temporary editing
- Express API server for backend operations
- Studio web interface for visual editing
- MCP server for Claude Code integration

**Input Types:**
- **Course directory:** Scaffolded project with package.json and static-data/
- **Manifest file:** Direct path to manifest.json with chunks/ and indices/

**Workflow:**
1. Loads course data into CouchDB
2. Opens web editor for content editing
3. Use "Flush to Static" to save changes back to source files

### `pack`

Pack a CouchDB course into static files for deployment.

```bash
skuilder pack <courseId> [options]
```

**Arguments:**
- `courseId` - Course ID to pack from CouchDB (required)

**Options:**
- `-s, --server <url>` - CouchDB server URL (default: `http://localhost:5984`)
- `-u, --username <username>` - CouchDB username
- `-p, --password <password>` - CouchDB password
- `-o, --output <dir>` - Output directory (default: ./static-courses)
- `-c, --chunk-size <size>` - Documents per chunk (default: 1000)
- `--no-attachments` - Exclude attachments from pack

**Output:**
- Static course bundle with manifest.json
- Chunks/ directory with paginated course data
- Indices/ directory with database views and indexes
- Asset files and media content

### `unpack`

Unpack a static course directory into CouchDB for editing.

```bash
skuilder unpack <coursePath> [options]
```

**Arguments:**
- `coursePath` - Path to static course directory (required)

**Options:**
- `-s, --server <url>` - CouchDB server URL (default: `http://localhost:5984`)
- `-u, --username <username>` - CouchDB username
- `-p, --password <password>` - CouchDB password
- `-d, --database <name>` - Target database name (auto-generated if not provided)
- `--as <name>` - Set custom name for the unpacked course
- `--chunk-size <size>` - Documents per batch (default: 100)
- `--validate` - Run migration validation
- `--cleanup-on-error` - Clean up database if migration fails

**Operation:**
- Imports static course files into CouchDB
- Creates database with course documents
- Sets up indices and views for querying
- Enables dynamic editing in studio mode

## Global Options

- `-h, --help` - Display help information
- `-V, --version` - Display version number

## Requirements

- **Node.js:** >= 18.0.0
- **Docker:** Required for studio mode (CouchDB)
- **Git:** Recommended for version control

## Examples

```bash
# Create new course project
skuilder init my-anatomy-course --theme medical

# Launch studio for course directory
skuilder studio ./my-course

# Launch studio for deployed course
skuilder studio ./docs/static-courses/course-id/manifest.json

# Pack course from CouchDB to static files
skuilder pack biology-101 --server http://localhost:5984 --username admin

# Unpack static course into CouchDB for editing
skuilder unpack ./static-courses/biology-101 --validate

# Studio with custom port, no browser
skuilder studio . --port 6000 --no-browser
```

## Workflows

### Development Workflow
1. `skuilder init my-course` - Create project
2. `skuilder studio` - Launch editing environment
3. Edit content in studio web interface
4. Use "Flush to Static" to save changes

### Deployment Workflow
1. `skuilder pack course-id` - Export from CouchDB to static files
2. Deploy static files to web server
3. `skuilder studio manifest.json` - Edit deployed course directly

### Migration Workflow
1. `skuilder unpack ./static-course` - Import to CouchDB
2. `skuilder studio` - Edit in dynamic environment
3. `skuilder pack course-id` - Export back to static
