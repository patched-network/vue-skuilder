# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- Build: `yarn build` (builds all packages in dependency order)
- Dev: `yarn dev` (starts CouchDB, platform-ui, express)
- Lint: `yarn workspace @vue-skuilder/platform-ui lint` or `yarn workspace @vue-skuilder/express lint:fix`
- Type check: `yarn workspace @vue-skuilder/express type-check`
- Unit tests: `yarn workspace @vue-skuilder/platform-ui test:unit`
- Run single test: `yarn workspace @vue-skuilder/platform-ui test:unit <test-file-path>`
- E2E tests: `yarn workspace @vue-skuilder/platform-ui test:e2e`
- Database E2E tests: `yarn workspace @vue-skuilder/e2e-db test`

### Backend Package Commands
- Build common: `yarn workspace @vue-skuilder/common build`
- Build db: `yarn workspace @vue-skuilder/db build`
- Build express: `yarn workspace @vue-skuilder/express build`
- Test e2e-db: `yarn workspace @vue-skuilder/e2e-db test`

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