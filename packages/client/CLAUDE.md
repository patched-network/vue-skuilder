# @vue-skuilder/client Package

**⚠️ LEGACY/INACTIVE PACKAGE** - Minimal maintenance, consider alternatives for new development.

Legacy HTTP client library for vue-skuilder API communication. This package is not actively developed.

## Commands
- Build: `yarn workspace @vue-skuilder/client build` (Rollup + TypeScript)
- Dev: `yarn workspace @vue-skuilder/client dev` (Rollup watch mode)
- Lint: `yarn workspace @vue-skuilder/client lint`

## Build System
- **Bundler**: Rollup with TypeScript plugin
- **Output**: UMD and ES module formats
- **Legacy**: Uses older build tooling compared to other packages

## Dependencies
- `axios` - HTTP client (primary functionality)
- `command-line-args` - CLI argument parsing

## Status
This package is in maintenance mode:
- **No Active Development**: New features not being added
- **Minimal Updates**: Only critical bug fixes
- **Legacy Build System**: Uses Rollup instead of modern Vite
- **Superseded**: Functionality replaced by direct axios usage in other packages

## Migration Path
For new development, use:
- Direct `axios` imports in frontend packages
- Express server endpoints for backend API communication
- `@vue-skuilder/db` for database operations

## Historical Context
Originally provided API abstraction layer, but architectural changes made direct HTTP client usage more appropriate.