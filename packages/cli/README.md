# Skuilder CLI

A command-line tool for scaffolding Skuilder course applications.

A Skuilder course consists of:
- a Vue.js application
- a data layer (static or dynamic)

Static data-layer courses are self-contained as JSON files, and can be deployed as a static site.

Dynamic data-layer courses are served from a CouchDB database and require a more involved setup ⚠️ **which is not currently well documented** ⚠️.

## Installation

Install globally via npm:

```bash
npm install -g skuilder
```

Or use npx to run without installing:

```bash
npx skuilder init my-course
```

## Commands

### Project Initialization

#### Create a new project

```bash
skuilder init my-anatomy-course
```

This will start an interactive prompt to configure your project:
- Course title
- Data layer type (static or dynamic)
- CouchDB connection details (for dynamic)
- Theme selection
- Course ID to import (optional import from a live CouchDB server)

#### Non-interactive mode

```bash
skuilder init physics-101 \
  --data-layer=static \
  --theme=educational \
  --no-interactive
```

#### Dynamic data layer with CouchDB

```bash
skuilder init biology-course \
  --data-layer=dynamic \
  --couchdb-url=https://my-couch.server.com:5984 \
  --course-id=bio-101-2024 \
  --theme=medical
```

#### Command Options

- `--data-layer <type>` - Choose data layer: `static` or `dynamic` (default: dynamic)
- `--theme <name>` - Select theme: `default`, `medical`, `educational`, or `corporate` (default: default)
- `--no-interactive` - Skip interactive prompts and use provided options
- `--couchdb-url <url>` - CouchDB server URL (required for dynamic data layer)
- `--course-id <id>` - Course ID to import from CouchDB (optional)

### Studio Mode (Content Editing)

Studio mode provides a complete visual editing environment for static courses:

```bash
skuilder studio                       # Launch in current directory
skuilder studio ./my-course           # Launch against specific skuilder app w/ packed course data
skuilder studio ./some/manifest.json  # Launch against a specific packed course on disk
skuilder studio --port 6000           # Use custom CouchDB port
skuilder studio --no-browser          # Don't auto-open browser
```

#### What Studio Mode Does

Studio mode creates a full editing environment by starting multiple services:

1. **CouchDB Instance** (Docker container on port 5985+)
   - Temporary database for editing course content
   - Automatically loads your static course data

2. **Express API Server** (port 3001+)
   - Handles database operations and file writes
   - Provides REST API for the web editor

3. **Studio Web Interface** (port 7174+)
   - Visual course editor with Vue.js
   - Create/edit cards, manage tags, bulk import
   - Live preview of changes

4. **MCP Server** (Course Content Agent)
   - Model Context Protocol server for Claude Code integration
   - AI-powered course content authoring and editing
   - Direct access to course data, cards, tags, and ELO ratings
   - Configuration for MCP clients is output at startup

#### Studio Workflow

1. **Load Course Data**: Unpacks your `public/static-courses/` JSON files into temporary CouchDB
2. **Visual Editing**: Use the web interface to modify course content
3. **Save Changes**: Click "Flush to Static" to write changes back to your course files
4. **Important**: Studio mode **overwrites** your source files - backup before major edits

#### Requirements

- **Docker**: Required for CouchDB instance
- **Static Course Project**: Valid package.json with vue-skuilder dependencies
- **Course Data**: Existing content in `public/static-courses/` directory

#### Studio Mode vs Regular Development

| Feature | Regular Dev (`npm run dev`) | Studio Mode (`skuilder studio`) |
|---------|----------------------------|--------------------------------|
| Purpose | View/test course | Edit course content |
| Data Source | Static JSON files | Temporary CouchDB + Web Editor |
| Editing | Manual JSON editing | Visual web interface |
| Services | Just Vite dev server | CouchDB + Express + Studio UI |
| File Changes | Manual | Automatic via "Flush to Static" |

### Course Data Management

#### Pack/Unpack Commands

For advanced users working with CouchDB data:

```bash
# Convert CouchDB course to static files
skuilder pack my-course-id \
  --server http://localhost:5984 \
  --username admin \
  --password secret \
  --output ./exported-course

# Convert static files to CouchDB course
skuilder unpack ./course-data \
  --server http://localhost:5984 \
  --username admin \
  --password secret \
  --database coursedb-imported \
  --validate
```

**Pack Command Options:**
- `--server <url>` - CouchDB server URL (default: http://localhost:5984)
- `--username <user>` - CouchDB username for authentication
- `--password <pass>` - CouchDB password for authentication
- `--output <dir>` - Output directory for static files (default: ./static-courses)
- `--chunk-size <size>` - Documents per chunk for large courses (default: 1000)
- `--no-attachments` - Skip downloading course attachments

**Unpack Command Options:**
- `--server <url>` - CouchDB server URL (default: http://localhost:5984)
- `--username <user>` - CouchDB username for authentication
- `--password <pass>` - CouchDB password for authentication
- `--database <name>` - Target database name (auto-generated if not provided)
- `--as <name>` - Custom name for the unpacked course
- `--chunk-size <size>` - Documents per batch upload (default: 100)
- `--validate` - Run migration validation after unpack
- `--cleanup-on-error` - Remove database if migration fails

**Use Cases:**
- **Studio Mode Internal**: These commands power studio mode's load/save operations
- **Migration**: Move courses between static and dynamic deployments
- **Backup/Restore**: Export course data for safekeeping or transfer
- **CI/CD Workflows**: Automate course deployment and synchronization
- **Development**: Test with production course data locally

## Generated Project Structure

```
my-course/
├── src/
│   ├── components/      # Vue components
│   ├── views/          # Route views
│   ├── stores/         # Pinia stores
│   └── main.ts         # App entry point
├── public/             # Static assets
├── skuilder.config.json # Course configuration
├── package.json        # Project dependencies
├── vite.config.ts      # Build configuration
└── README.md           # Project documentation
```

## Data Layer Types

### Static Data Layer
- Self-contained JSON files for course data
- Static deployment friendly
- User progress tracking via browser localstorage
- Includes sample course data

### Dynamic Data Layer
- Connects to CouchDB server for course data
- Real-time data synchronization
- courses 'adaptive' to global usage, eg,
  - dynamic
- User progress tracking both locally (as in static deployments) and in serverside CouchDB (allowing multi-device use)
- Course content management UIs

## Themes

### Predefined Themes

- **Default**: Material Blue (`#1976D2`, `#424242`, `#82B1FF`)
- **Medical**: Healthcare Green (`#2E7D32`, `#558B2F`, `#66BB6A`)
- **Educational**: Academic Orange (`#F57C00`, `#FF9800`, `#FFB74D`)
- **Corporate**: Professional Gray (`#37474F`, `#546E7A`, `#78909C`)

Themes are applied via Vuetify's theming system and can be customized after project generation.

## Development

### Working on the CLI

Clone the repository and install dependencies:

```bash
git clone https://github.com/patched-network/vue-skuilder.git
cd vue-skuilder
yarn install
```

Build the CLI package:

```bash
yarn workspace @vue-skuilder/cli build
```

Link for local testing:

```bash
cd packages/cli
npm link
skuilder init test-project
```

### Testing

Run the CLI locally:

```bash
yarn workspace @vue-skuilder/cli build
node packages/cli/dist/cli.js init test-project
```

## Requirements

### System Requirements

- **Node.js 18.0.0 or higher**
- **npm or yarn package manager**
- **Docker** (required for studio mode only)
  - Used to run temporary CouchDB instances
  - Not needed for basic project creation or static course viewing

## Dependencies

The CLI generates projects using published `@vue-skuilder/*` packages:

- `@vue-skuilder/common-ui` - Vue component library
- `@vue-skuilder/db` - Database abstraction layer
- `@vue-skuilder/standalone-ui` - Template source

Generated projects include:
- Vue 3 with Composition API
- Vuetify 3 for UI components
- Pinia for state management
- Vue Router for navigation
- TypeScript support
- Vite for building and development

## Support

- Documentation: [Vue Skuilder Repository](https://github.com/patched-network/vue-skuilder)
- Issues: [GitHub Issues](https://github.com/patched-network/vue-skuilder/issues)
