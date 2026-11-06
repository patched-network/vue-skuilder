# @vue-skuilder/db Package

Database abstraction layer providing unified interfaces for CouchDB/PouchDB and static data providers.

## Commands
- Build: `yarn workspace @vue-skuilder/db build`
- Dev (watch): `yarn workspace @vue-skuilder/db dev`
- Lint: `yarn workspace @vue-skuilder/db lint:fix`
- Test: `yarn workspace @vue-skuilder/db test`

## Build System
- **ESM**: Rolldown (`rolldown.config.mjs`), one `.mjs` per source module
  (`preserveModules`), so apps load what they import and dynamic `import()`s
  stay separate chunks. `@db/` aliases resolve via tsconfig `paths`.
- **CommonJS**: tsup, one `.cjs` bundle per entry (Node, tests)
- **Types**: tsup (`dts: { only: true }`), `.d.ts` per entry
- Entries: `build.entries.mjs`, shared by both
- Dependencies (and Node builtins) stay external; declare anything imported.
- No template-literal `import()`: bundlers glob it over the directory, which
  in a per-module dist matches `.map`/`.d.ts` files.

### `sideEffects`
package.json lists the modules that act on import; everything else may be
dropped by an app's bundler when unused. Add a module there if it does work at
top level that someone relies on (registration, `window.*` mounts).

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
- `process` - browser polyfill PouchDB needs on `window` (set in `impl/couch/pouchdb-setup.ts`)

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
