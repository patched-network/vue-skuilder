# @vue-skuilder/common Package

Shared TypeScript library providing common types, interfaces, and utilities used across all vue-skuilder packages.

## Commands
- Build: `yarn workspace @vue-skuilder/common build` (complex dual-format build)
- Dev: `yarn workspace @vue-skuilder/common dev` (TypeScript watch mode)
- Lint: `yarn workspace @vue-skuilder/common lint:fix`

## Build System
Complex dual-format build supporting both CommonJS and ESM:

### Build Process
1. **CJS Build**: `tsc -p tsconfig.cjs.json` → `dist/`
2. **ESM Build**: `tsc -p tsconfig.esm.json` → `dist-esm/`  
3. **File Transformation**: Convert `.js` extensions to `.mjs` for ESM
4. **File Renaming**: Rename all `.js` files to `.mjs` in ESM build
5. **Merge**: Copy ESM files to `dist/` alongside CJS files
6. **Cleanup**: Remove temporary `dist-esm/`

### Package Exports
- **Types**: `./dist/index.d.ts`
- **Import (ESM)**: `./dist/index.mjs`
- **Require (CJS)**: `./dist/index.js`

## Dependencies
- `moment` - Date/time manipulation (only runtime dependency)

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
- **Minimal Runtime**: Only essential dependencies (moment.js)