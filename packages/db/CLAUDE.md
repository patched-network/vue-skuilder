# @vue-skuilder/db Package

Database abstraction layer providing unified interfaces for CouchDB/PouchDB and static data providers.

## Commands
- Build: `yarn workspace @vue-skuilder/db build`
- Dev (watch): `yarn workspace @vue-skuilder/db dev`
- Lint: `yarn workspace @vue-skuilder/db lint:fix`
- Type check: `tsc --noEmit` (no dedicated script)

## Build System
Uses **tsup** for dual CommonJS/ESM output:
- **ESM**: `dist/index.mjs` (primary)
- **CommonJS**: `dist/index.js` (Jest compatibility)
- **Types**: `dist/index.d.ts`

## Package Exports
Multiple entry points for different use cases:
- **Main**: Core interfaces and factory
- **Core**: Core types and interfaces only
- **Pouch**: PouchDB implementation
- **Packer**: Static data packing utilities  
- **Static**: Static data provider implementation

## Dependencies
- `@vue-skuilder/common` - Shared types and utilities
- `pouchdb` - Client-side database
- `pouchdb-find` - Query plugin
- `@nilock2/pouchdb-authentication` - Auth plugin

## Architecture
- **Interfaces**: Abstract DB layer contracts (`core/interfaces/`)
- **Implementations**: 
  - CouchDB/PouchDB provider (`impl/couch/`)
  - Static data provider (`impl/static/`)
- **Study System**: Spaced repetition logic (`study/`)
- **Utilities**: Logging, packing tools (`util/`)

## Key Features
- **Provider Pattern**: Switchable backend implementations
- **Dual Export**: Works in both Node.js and browser environments  
- **Type Safety**: Full TypeScript coverage with strict mode
- **Sync Strategy**: Configurable online/offline data synchronization