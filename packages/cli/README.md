# Skuilder CLI

A command-line tool for scaffolding Skuilder course applications.

## Installation

Install globally via npm:

```bash
npm install -g skuilder
```

Or use npx to run without installing:

```bash
npx skuilder init my-course
```

## Usage

### Create a new project

```bash
skuilder init my-anatomy-course
```

This will start an interactive prompt to configure your project:
- Course title
- Data layer type (static or dynamic)
- CouchDB connection details (for dynamic)
- Theme selection
- Course ID to import (optional)

### Non-interactive mode

```bash
skuilder init physics-101 \
  --data-layer=static \
  --theme=educational \
  --no-interactive
```

### Dynamic data layer with CouchDB

```bash
skuilder init biology-course \
  --data-layer=dynamic \
  --couchdb-url=https://my-couch.server.com:5984 \
  --course-id=bio-101-2024 \
  --theme=medical
```

## Command Options

- `--data-layer <type>` - Choose data layer: `static` or `dynamic` (default: dynamic)
- `--theme <name>` - Select theme: `default`, `medical`, `educational`, or `corporate` (default: default)
- `--no-interactive` - Skip interactive prompts and use provided options
- `--couchdb-url <url>` - CouchDB server URL (required for dynamic data layer)
- `--course-id <id>` - Course ID to import from CouchDB (optional)

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

- Node.js 18.0.0 or higher
- npm or yarn package manager

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
