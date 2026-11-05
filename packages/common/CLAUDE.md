# @vue-skuilder/common Package

Shared TypeScript library providing common types, interfaces, and utilities used across all vue-skuilder packages.

## Commands
- Build: `yarn workspace @vue-skuilder/common build` (`scripts/build.mjs`)
- Dev: `yarn workspace @vue-skuilder/common dev` (reruns the build when `src/` changes)
- Lint: `yarn workspace @vue-skuilder/common lint:fix`

## Build System
`scripts/build.mjs` compiles with tsc twice and writes one file per source
module into `dist/`, both formats side by side:

- `x.mjs` ESM (`tsconfig.esm.json`)
- `x.cjs` CommonJS (`tsconfig.cjs.json`). Not `.js`: the package is
  `"type": "module"`, so Node would load a CommonJS `.js` as ESM and fail.
- `x.d.ts` types, from the ESM pass

It renames what tsc emits and rewrites relative specifiers, sourcemap
comments and map `file` fields to match.

`"sideEffects": false`: no module does anything on import. Keep it that way, or
replace it with a list of the modules that do.

### Package Exports
- **Types**: `./dist/index.d.ts`
- **Import (ESM)**: `./dist/index.mjs`
- **Require (CJS)**: `./dist/index.cjs`
- `./docker` subpath likewise (Node only, not in the main index)

## Dependencies
- `moment`: dates
- `zod`, `zod-to-json-schema`: schemas (db's `courseConfigRegistration`)

## Package Contents

### Core Types & Interfaces
- **DataShape**: Core data structure definitions (`interfaces/DataShape.ts`)
- **FieldDefinition**: Form field type system (`interfaces/FieldDefinition.ts`)
- **ViewData**: UI data presentation contracts (`interfaces/ViewData.ts`)
- **Answer Interfaces**: Question/answer type system (`interfaces/AnswerInterfaces.ts`)

### Enums
- **DataShapeNames**: Standardized data type identifiers (`enums/DataShapeNames.ts`)
- **FieldType**: Form field type enumeration (`enums/FieldType.ts`)

### Utilities
- **Field Converters**: Data transformation utilities (`fieldConverters.ts`)
- **Validators**: Input validation logic (`validators.ts`)
- **Wire Format**: Serialization helpers (`wire-format.ts`)
- **ELO System**: Rating algorithm implementation (`elo.ts`)
- **Course Data**: Course management utilities (`course-data.ts`)

### Bulk Import System
- **Card Parser**: Content parsing utilities (`bulkImport/cardParser.ts`)
- **Import Types**: Bulk operation type definitions (`bulkImport/types.ts`)

## Key Design Principles
- **Zero Framework Dependencies**: Pure TypeScript/JavaScript utilities
- **Universal Compatibility**: Works in Node.js, browsers, and bundlers
- **Type Safety**: Full TypeScript coverage with strict mode
- **Minimal Runtime**: few runtime dependencies (moment, zod)