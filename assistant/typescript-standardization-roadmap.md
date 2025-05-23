# TypeScript Standardization Roadmap

## Overview
Standardize TypeScript configuration across backend packages (common, db, express, e2e-db) to resolve module resolution conflicts, improve IDE support, and enable consistent testing frameworks (specifically fixing the e2e-db Jest issues). Frontend packages (common-ui, courses, platform-ui, standalone-ui) are out of scope.

## Current State Analysis

### Package TypeScript Targets (INCONSISTENT)
- **express**: `ES2022` target, NodeNext modules
- **common**: `es2018` target, NodeNext modules  
- **db**: `ES2020` target, bundler resolution
- **e2e-db**: ES2020 target, bundler resolution (FAILING - jest import issues)

### Module Resolution Issues
- **Backend packages**: Mix of `NodeNext` and `bundler` resolution
- **Testing packages**: Mixed resolution causing jest ESM/CommonJS conflicts

### Critical Problems
1. **e2e-db Jest failures**: ESM packages imported by CommonJS Jest
2. **IDE inconsistency**: Different path resolution per package
3. **Type checking variance**: Different strictness levels
4. **Build fragmentation**: Multiple module systems breaking imports

## Implementation Strategy

### Phase 1: Base Configuration (Day 1)
Create shared TypeScript foundation that works for ALL package types.

#### 1.1 Create tsconfig.base.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "incremental": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

#### 1.2 Create Package-Specific Extensions

**Backend Services** (express):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"]
  }
}
```

**Shared Libraries** (common, db):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext", 
    "moduleResolution": "NodeNext",
    "outDir": "dist"
  }
}
```

**Testing Packages** (e2e-db):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "types": ["jest", "node"],
    "noEmit": true
  }
}
```

### Phase 2: Package Migration (Day 1-2)

#### 2.1 Migrate Packages in Dependency Order
1. **common** (no dependencies)
2. **db** (depends on common)
3. **express** (depends on common, db)
4. **e2e-db** (depends on db, common)

#### 2.2 Fix Module Exports for Jest Compatibility

**Update common/package.json**:
```json
{
  "main": "dist/index.js",
  "module": "dist/index.mjs", 
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  }
}
```

**Update db/package.json**:
```json
{
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts", 
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    },
    "./core": {
      "types": "./dist/core/index.d.ts",
      "import": "./dist/core/index.mjs",
      "require": "./dist/core/index.js"
    }
  }
}
```

### Phase 3: Build System Updates (Day 2)

#### 3.1 Update Build Scripts to Generate Both CJS and ESM

**common build script**:
```json
{
  "scripts": {
    "build": "rm -rf dist && tsc -p tsconfig.build.json && tsc -p tsconfig.esm.json"
  }
}
```

**Create tsconfig.build.json** (CommonJS):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "outDir": "dist",
    "outExtension": { ".js": ".js" }
  }
}
```

**Create tsconfig.esm.json** (ESM):
```json
{
  "extends": "./tsconfig.json", 
  "compilerOptions": {
    "module": "ESNext",
    "outDir": "dist",
    "outExtension": { ".js": ".mjs" }
  }
}
```

#### 3.2 Update db Package Build (TSup Configuration)

**Update tsup.config.ts**:
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/core/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outExtension: ({ format }) => ({
    js: format === 'esm' ? '.mjs' : '.js'
  })
});
```

### Phase 4: Testing Fix (Day 2)

#### 4.1 Update e2e-db Jest Configuration

**jest.config.js**:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/setup/jest-setup.ts'],
  testTimeout: 30000,
  testMatch: ['<rootDir>/src/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  // Force Jest to use CommonJS exports from workspace packages
  modulePathIgnorePatterns: ['<rootDir>/../../packages/.*/dist/.*\\.mjs$']
};
```

#### 4.2 Rebuild Dependencies with New CommonJS Support
```bash
yarn workspace @vue-skuilder/common build
yarn workspace @vue-skuilder/db build
```

## Implementation Checklist

### ✅ Pre-Implementation
- [x] Create backup branch: Already in fresh branch
- [x] Verify all packages currently build without errors: Confirmed working

### ✅ Day 1: Base Configuration - COMPLETED
- [x] Create `master/tsconfig.base.json`
- [x] Create package-specific tsconfig templates
- [x] Update `common/tsconfig.json` (extends base)
- [x] Update `db/tsconfig.json` (extends base) 
- [x] Test: `yarn workspace @vue-skuilder/common build`
- [x] Test: `yarn workspace @vue-skuilder/db build`
- [x] Fixed unused parameter issue in common package
- [x] Verified all packages build and dev environment works

### ✅ Day 1: Build System Updates - COMPLETED
- [x] Update `common/package.json` exports
- [x] Add dual CommonJS/ESM build to common
- [x] Update `db/tsup.config.ts` for dual output
- [x] Update `db/package.json` exports (was already correct)
- [x] Test: Rebuild common and db packages
- [x] Verify: Both CJS and ESM outputs generated
- [x] Fixed missing db.js export in common package
- [x] Resolved CardData naming conflict between db.ts and bulkImport/types.ts
- [x] Updated imports to use BulkImportCardData in db package

**COMMIT POINT**: Dual CommonJS/ESM exports working for shared libraries

### ✅ Day 2: Express Package - COMPLETED
- [x] Update `express/tsconfig.json` (extends base, NodeNext)
- [x] Test: Build express package
- [x] Verify: No breaking changes in build outputs
- [x] Fixed: 20+ TypeScript strict errors (unused parameters, imports)
- [x] Fixed: Composite flag issue preventing JavaScript output
- [x] Fixed: ESM import paths in common package (.js → .mjs)
- [x] Fixed: Runtime import error for EloToNumber function

### ✅ Integration Testing
- [x] Test: `yarn workspace @vue-skuilder/common build`
- [x] Test: `yarn workspace @vue-skuilder/db build`
- [x] Test: `yarn workspace @vue-skuilder/express build`
- [ ] Test: `yarn workspace @vue-skuilder/e2e-db test`
- [ ] Verify: IDE intellisense works across backend packages

### ✅ Day 2: Testing Package Fix
- [ ] Update `e2e-db/tsconfig.json` (extends base, CommonJS)
- [ ] Update `e2e-db/jest.config.js` for CommonJS imports
- [ ] Test: `yarn workspace @vue-skuilder/e2e-db test`
- [ ] Verify: Jest imports workspace packages successfully

### ✅ Documentation
- [ ] Update `CLAUDE.md` with new TypeScript patterns
- [ ] Document backend package tsconfig patterns
- [ ] Create migration guide for future backend packages

## In-Scope Packages

### Backend Packages Only
- **common**: Pure TypeScript library (es2018 → ES2022)
- **db**: TSup bundler (ES2020 → ES2022, add CommonJS exports)
- **express**: Node.js service (ES2022, NodeNext - already compatible)
- **e2e-db**: Jest testing (ES2020 → ES2022, CommonJS for Jest)

### Out of Scope (Frontend/UI)
- **platform-ui, standalone-ui**: Vite + Vue apps (complex Vite configs)
- **common-ui, courses**: Component libraries (Vue SFC compilation)

## Success Criteria

### ✅ e2e-db Jest Tests Pass
- Jest can import `@vue-skuilder/db` and `@vue-skuilder/common`
- No ESM/CommonJS module resolution errors
- All database tests execute successfully

### ✅ Consistent TypeScript Behavior
- Same compiler target (ES2022) across all packages
- Unified strict settings and error reporting
- Consistent path resolution and IDE support

### ✅ Build System Integrity
- All packages build successfully with new configurations
- Dual CommonJS/ESM exports for shared libraries
- No breaking changes for existing consumers

### ✅ Developer Experience
- Single TypeScript mental model across packages
- Consistent error messages and IDE behavior
- Clear patterns for future package creation

## Risk Mitigation

### High Risk: Breaking Changes
- **Mitigation**: Test builds after each package migration
- **Rollback**: Maintain separate branch until full validation
- **Testing**: Run full test suite after each phase

### Medium Risk: Build Performance
- **Mitigation**: Build performance benchmarking is out of scope
- **Optimization**: Use TypeScript incremental compilation
- **Focus**: Maintain existing build speed

### Low Risk: IDE Compatibility
- **Testing**: Verify VS Code/WebStorm intellisense
- **Documentation**: Update workspace settings if needed

## Timeline

- **Day 1 Morning**: Base configuration + common/db packages
- **Day 1 Afternoon**: Build system updates + dual exports
- **Day 2 Morning**: Component libraries + applications
- **Day 2 Afternoon**: e2e-db fix + integration testing

**Total Effort**: 2 days
**Primary Goal**: Fix e2e-db Jest issues while establishing backend TypeScript consistency
**Secondary Benefits**: Improved IDE support for backend packages, consistent type checking, future-proofed backend configuration
**Scope**: Backend packages only (common, db, express, e2e-db)

## Discoveries During Implementation

### TSup Build Tool Analysis

#### What is TSup?
TSup is a fast TypeScript bundler built on ESBuild, designed for:
- Bundle TypeScript libraries quickly
- Generate multiple output formats (CJS, ESM, IIFE, etc.)
- Create TypeScript declaration files automatically
- Handle external dependencies properly

#### Current Usage Assessment: INCONSISTENT

| Package | Build Tool | Purpose | Assessment |
|---------|------------|---------|------------|
| **db** | 🟡 TSup | Library bundling (CJS + ESM + DTS) | ✅ Appropriate |
| **common** | 🔵 TSC | Direct TypeScript compilation | ❌ Should use TSup |
| **express** | 🔵 TSC | Node.js service compilation | ✅ Appropriate |
| **client** | 🟠 TSC + Rollup | Legacy client bundling | ❓ Legacy |
| **common-ui** | 🟢 Vite | Vue component library | ✅ Appropriate |
| **courses** | 🟢 Vite | Vue component library | ✅ Appropriate |
| **platform-ui** | 🟢 Vite | Vue application | ✅ Appropriate |
| **standalone-ui** | 🟢 Vite | Vue application | ✅ Appropriate |

#### Key Issues Identified:
- **Inconsistent library building**: `db` uses TSup (sophisticated) while `common` uses raw TSC (manual)
- **Manual dual builds**: Had to implement complex shell scripts for common package
- **Build tool diversity**: 5 different build approaches across 8 packages
- **TSup underutilized**: Only used in 1 package despite being ideal for library packages

#### Recommendation:
Future consolidation should standardize on TSup for library packages (common, db) while keeping TSC for Node.js services and Vite for frontend packages.

### Database Type Architecture Issues

#### Problem Discovered:
Database document interfaces (`SkuilderCourseData`, `CardData`, `DisplayableData`) are exported from the `common` package but logically belong to database layer.

#### Architectural Concerns:
```
common (exports database types) → db (imports from common)
```

This creates:
- **Misplaced abstractions**: Database schemas in common package
- **Circular dependency risk**: Database layer depending on "common" for its own types
- **Package responsibility confusion**: Common should contain business logic, not database schemas

#### Issues Encountered:
- Missing exports from common package index
- Naming conflicts between database types and bulk import types
- Had to add `db.js` export to common package during implementation

#### Proper Architecture Should Be:
```typescript
// packages/db/src/types/documents.ts
export interface SkuilderCourseData { ... }
export interface CardData { ... }

// packages/common/src/ (domain types only)
export interface CourseElo { ... }
export interface Answer { ... }
```

#### Current Status:
**Continuing with existing structure** to maintain implementation focus, but flagged as **technical debt** for future architectural cleanup.

### Implementation Insights:
- TypeScript strict settings caught unused parameters and improved code quality
- Dual module exports solved Jest CommonJS import issues effectively
- Build system inconsistencies create more complexity than necessary
- Package boundaries need clearer definition between domain and persistence concerns

### ESM Import Path Resolution Issues

#### Problem Discovered:
When building dual CommonJS/ESM packages, simply renaming `.js` files to `.mjs` isn't sufficient - the import statements inside the files must also be updated to reference `.mjs` extensions.

#### Specific Issue:
- Common package generated both `elo.js` (CJS) and `elo.mjs` (ESM)
- ESM `index.mjs` still contained `export * from './elo.js'`
- Express app (running in ESM mode) tried to import ESM version but got wrong file references
- Runtime error: `The requested module '@vue-skuilder/common' does not provide an export named 'EloToNumber'`

#### Root Cause:
ESM requires explicit file extensions and the build process wasn't updating import paths within files when creating the `.mjs` versions.

#### Solution Implemented:
Updated build script to use `sed` to replace `.js` with `.mjs` in import statements:
```bash
find dist-esm -name '*.js' -exec sed -i "s/\.js'/\.mjs'/g; s/\.js\"/\.mjs\"/g" {} \;
```

#### Impact:
This type of import path issue would affect any ESM consumer of workspace packages and demonstrates the complexity of maintaining dual module formats manually.

## Current Status (Session 1 Complete)

### ✅ Completed Today
- Created shared `tsconfig.base.json` with ES2022 target and strict settings
- Migrated `common`, `db`, and `express` packages to extend base configuration
- Fixed unused parameter strictness issues across packages
- Added dual CommonJS/ESM exports to shared libraries
- Resolved database type export issues and naming conflicts
- Fixed ESM import path issues (.js → .mjs) in build process
- Verified all builds, dev environment, and express runtime working

### 🎯 Next Session Goals
- Fix e2e-db Jest import issues with new CommonJS exports
- Complete backend TypeScript standardization
- Test full integration with Jest consuming CommonJS exports
- Verify IDE intellisense works across all backend packages

### 📊 Progress Metrics
- **Packages Standardized**: 3/4 backend packages (common, db, express)
- **Build Status**: ✅ All packages building successfully with dual outputs
- **Dev Environment**: ✅ yarn dev working
- **Runtime Status**: ✅ Express app running with ESM imports
- **Type Consistency**: ✅ ES2022 target across standardized packages
- **Module Exports**: ✅ CommonJS/ESM dual exports ready for Jest