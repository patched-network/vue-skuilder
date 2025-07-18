# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Meta

User often uses dictation software, which, in context, mangles things like `vue` as `view`. Account for this when reading user prompts. Seek clarification if necessary.

## Commands

### Project Setup & Development
- Setup: `yarn setup` (install dependencies, git submodules)
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
- `@courses` → `./packages/courses/src`
- `@express` → `./packages/express/src`
- `@pui` → `./packages/platform-ui/src`
- `@sui` → `./packages/standalone-ui/src`
- `@e2e-db` → `./packages/e2e-db/src`
- `@cli` → `./packages/cli/src`
- `@client` → `./packages/client/src`

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
```

### Active Packages
- **Backend**: `common`, `db`, `express`, `e2e-db`
- **Frontend**: `platform-ui`, `common-ui`, `courses`, `standalone-ui`
- **CLI**: `cli`

### Legacy/Inactive Packages
- **client**: Legacy HTTP client library, minimal maintenance
