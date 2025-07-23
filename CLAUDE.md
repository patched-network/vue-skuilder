# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Meta

User often uses dictation software, which, in context, mangles things like `vue` as `view`. Account for this when reading user prompts. Seek clarification if necessary.

## Commands

### Project Setup & Development
- Setup: `yarn setup` (install dependencies, git submodules, build library packages)
- Dev: `yarn dev` (starts CouchDB, platform-ui, express)
- Build: `yarn build` (builds all packages in dependency order)
- Clean: `yarn clean` (removes dist and node_modules)

### CouchDB Management
- Start: `yarn couchdb:start` or `yarn dev:couchdb`
- Stop: `yarn couchdb:stop`
- Status: `yarn couchdb:status`
- Remove: `yarn couchdb:remove`

### Testing Commands
- Database E2E tests: `yarn workspace @vue-skuilder/e2e-db test` // known broken - only used for bespoke manual testing
- Database E2E watch: `yarn workspace @vue-skuilder/e2e-db test:watch` // known broken - only used for bespoke manual testing
- Unit tests (platform-ui): `yarn workspace @vue-skuilder/platform-ui test:unit`
- Unit tests (common-ui): `yarn workspace @vue-skuilder/common-ui test:unit`
- Unit tests (courses): `yarn workspace @vue-skuilder/courseware test`
- Run single test: `yarn workspace @vue-skuilder/platform-ui test:unit <test-file-path>`
- E2E tests (platform-ui): `yarn workspace @vue-skuilder/platform-ui test:e2e:headless`
- E2E tests (standalone-ui): `yarn workspace @vue-skuilder/standalone-ui test:e2e:headless`

### Package-Specific Commands

#### Backend Packages
- Build common: `yarn workspace @vue-skuilder/common build`
- Build db: `yarn workspace @vue-skuilder/db build`
- Build express: `yarn workspace @vue-skuilder/express build`
- Test express: `yarn workspace @vue-skuilder/express test`
- Build mcp: `yarn workspace @vue-skuilder/mcp build`
- Dev mcp: `yarn workspace @vue-skuilder/mcp dev` (build + MCP Inspector UI)
- Test mcp: `yarn workspace @vue-skuilder/mcp test:cli`

#### Frontend Packages
- Build platform-ui: `yarn workspace @vue-skuilder/platform-ui build`
- Build common-ui: `yarn workspace @vue-skuilder/common-ui build`
- Build courses: `yarn workspace @vue-skuilder/courseware build`
- Build standalone-ui: `yarn workspace @vue-skuilder/standalone-ui build`

#### CLI & Tools
- Build cli: `yarn workspace @vue-skuilder/cli build`
- Build client: `yarn workspace @vue-skuilder/client build` (legacy/inactive)

### Lint & Type Check Commands
- Lint platform-ui: `yarn workspace @vue-skuilder/platform-ui lint`
- Lint common-ui: `yarn workspace @vue-skuilder/common-ui lint`
- Lint express: `yarn workspace @vue-skuilder/express lint:fix`
- Lint common: `yarn workspace @vue-skuilder/common lint:fix`
- Lint db: `yarn workspace @vue-skuilder/db lint:fix`
- Lint e2e-db: `yarn workspace @vue-skuilder/e2e-db lint:fix`
- Lint cli: `yarn workspace @vue-skuilder/cli lint:fix`
- Type check express: `yarn workspace @vue-skuilder/express type-check`
- Type check e2e-db: `yarn workspace @vue-skuilder/e2e-db type-check`
- Type check courses: `yarn workspace @vue-skuilder/courseware type-check`

## Style Guidelines
- Use TypeScript with strict typing
- Format: singleQuote, 2-space tabs (4 for JSON), 100 char line width (120 for Vue files)
- Import order: external modules first, then internal modules
- Vue components use PascalCase
- CSS uses kebab-case
- Variables/functions use camelCase
- Use async/await for promises
- Error handling: try/catch blocks for async code
- Use ESLint and Prettier for code formatting
- Follow Vue 3 Composition API patterns

## TypeScript Configuration (Backend Packages)
Backend packages (`common`, `db`, `express`, `e2e-db`) follow standardized TypeScript configuration:

### Shared Base Configuration
- **Target**: ES2022 with strict settings enabled
- **Module System**: NodeNext for libraries, CommonJS for testing
- **Base Config**: All backend packages extend `tsconfig.base.json`

### Package-Specific Patterns
- **Shared Libraries** (`common`, `db`): Dual CommonJS/ESM exports for maximum compatibility
- **Node.js Services** (`express`): ES modules with NodeNext resolution
- **Testing Packages** (`e2e-db`): CommonJS with Jest compatibility

### TypeScript Best Practices
- All backend packages use consistent ES2022 target
- Strict type checking enabled (noUnusedLocals, noUnusedParameters, etc.)
- ESM imports use `.mjs` extensions in build outputs
- CommonJS exports available for Jest testing compatibility

## Shared Vite Configuration
Frontend packages use a shared Vite configuration system via `vite.config.base.js`:

### Alias System
The monorepo uses a dual alias system for package imports:

#### Inter-Package Aliases (`@vue-skuilder/*`)
- **Development**: Resolve to source directories (e.g., `./packages/db/src`)
- **Production**: Resolve to built outputs (e.g., `./packages/db/dist/index.mjs`)
- **Style Imports**: Special handling for `/style` suffixes pointing to CSS files

#### Intra-Package Aliases (`@{shortname}/*`)
Always resolve to source directories for internal package references:
- `@db` → `./packages/db/src`
- `@common` → `./packages/common/src`
- `@cui` → `./packages/common-ui/src`
- `@courseware` → `./packages/courseware/src`
- `@express` → `./packages/express/src`
- `@pui` → `./packages/platform-ui/src`
- `@sui` → `./packages/standalone-ui/src`
- `@e2e-db` → `./packages/e2e-db/src`
- `@cli` → `./packages/cli/src`
- `@client` → `./packages/client/src`
- `@mcp` → `./packages/mcp/src`

### Shared Configuration Features
- **Target**: ES2020 for consistency across packages
- **Minification**: Terser with `keep_classnames: true` for dynamic loading
- **Deduplication**: Shared Vue, Vuetify, Vue Router, Pinia instances
- **Source Maps**: Enabled for all builds
- **CSS Code Splitting**: Enabled for component libraries

### Package-Specific Vite Usage
- **platform-ui**: Application build with PWA, distinct port 5173
- **standalone-ui**: Application build, distinct port 6173
- **common-ui**: Library build with UMD/ES formats
- **courses**: Library build with asset handling

## Package Architecture

### Build Dependencies (Order Matters)
```
common → db → common-ui → courses → platform-ui
          ↓       ↓           ↓
         cli    express    standalone-ui
          ↓
         mcp
```

### Active Packages
- **Backend**: `common`, `db`, `express`, `e2e-db`, `mcp`
- **Frontend**: `platform-ui`, `common-ui`, `courses`, `standalone-ui`
- **CLI**: `cli`

### Legacy/Inactive Packages
- **client**: Legacy HTTP client library, minimal maintenance

## MCP Package (`@vue-skuilder/mcp`)

Model Context Protocol (MCP) server for Vue-Skuilder course content agent access.

### Architecture
Course-scoped MCP servers that accept CourseDBInterface injection:
- **Resources**: Read-only data access (course, cards, tags, elo, shapes)
- **Tools**: Content generation and management operations
- **Prompts**: Templates for guided content creation

### Build System
Uses **tsup** for dual CommonJS/ESM output:
- **ESM**: `dist/index.mjs` (primary)
- **CommonJS**: `dist/index.js` (compatibility)
- **Types**: `dist/index.d.ts`

### Available Resources (14 total)
- `course://config` - Course configuration with metadata and ELO statistics
- `cards://all` - All cards with pagination support
- `cards://tag/{tagName}` - Filter cards by tag name
- `cards://shape/{shapeName}` - Filter cards by DataShape
- `cards://elo/{eloRange}` - Filter cards by ELO range (format: min-max)
- `shapes://all` - List all available DataShapes
- `shapes://{shapeName}` - Specific DataShape information
- `tags://all` - List all available tags
- `tags://stats` - Tag usage statistics
- `tags://{tagName}` - Specific tag information
- `tags://union/{tags}` - Cards with ANY of specified tags (format: tag1+tag2)
- `tags://intersect/{tags}` - Cards with ALL of specified tags (format: tag1+tag2)
- `tags://exclusive/{tags}` - Cards with first tag but NOT second (format: tag1-tag2)
- `tags://distribution` - Frequency distribution of all tags

### Available Tools (4 total)
- `create_card` - Create new course cards with specified datashape and content
- `update_card` - Update existing course cards (data, tags, ELO, sourceRef)
- `tag_card` - Add or remove tags from course cards with optional ELO update
- `delete_card` - Safely delete course cards with confirmation requirement

### Available Prompts (2 total)
- `fill-in-card-authoring` - Generate fill-in-the-blank or multiple-choice cards using Vue-Skuilder syntax
- `elo-scoring-guidance` - Guidance for assigning ELO difficulty ratings to flashcard content

### Key Features
- **ELO-aware**: Native support for Vue-Skuilder's dynamic rating system
- **DataShape aware**: Supports all Vue-Skuilder question types
- **Source linking**: Git-based content provenance tracking
- **Content generation**: Orchestrated courseware creation from source materials
- **Strongly typed**: All resources, tools, and prompts use TypeScript constants

### Usage
```typescript
import { MCPServer } from '@vue-skuilder/mcp';
import { getDataLayer } from '@vue-skuilder/db';

const courseDB = getDataLayer().getCourseDB('course-id');
const server = new MCPServer(courseDB);
```

### Testing
Use MCP Inspector for interactive testing:
```bash
yarn workspace @vue-skuilder/mcp dev  # Opens Inspector UI automatically
```

### Dependencies
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `@vue-skuilder/db` - Database layer access
- `@vue-skuilder/common` - Shared types and utilities
- `zod` - Schema validation
