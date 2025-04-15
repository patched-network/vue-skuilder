# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- Build: `yarn build`
- Dev: `yarn dev` (starts CouchDB, platform-ui, express)
- Lint: `yarn workspace @vue-skuilder/platform-ui lint` or `yarn workspace @vue-skuilder/express lint:fix`
- Type check: `yarn workspace @vue-skuilder/express type-check`
- Unit tests: `yarn workspace @vue-skuilder/platform-ui test:unit`
- Run single test: `yarn workspace @vue-skuilder/platform-ui test:unit <test-file-path>`
- E2E tests: `yarn workspace @vue-skuilder/platform-ui test:e2e`

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