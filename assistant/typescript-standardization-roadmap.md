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

### ✅ Day 1: Build System Updates - READY FOR NEXT SESSION
- [ ] Update `common/package.json` exports
- [ ] Add dual CommonJS/ESM build to common
- [ ] Update `db/tsup.config.ts` for dual output
- [ ] Update `db/package.json` exports
- [ ] Test: Rebuild common and db packages
- [ ] Verify: Both CJS and ESM outputs generated

**COMMIT POINT**: Base TypeScript configuration standardized across backend packages

### ✅ Day 2: Express Package
- [ ] Update `express/tsconfig.json` (extends base, NodeNext)
- [ ] Test: Build express package
- [ ] Verify: No breaking changes in build outputs

### ✅ Integration Testing
- [ ] Test: `yarn workspace @vue-skuilder/common build`
- [ ] Test: `yarn workspace @vue-skuilder/db build`
- [ ] Test: `yarn workspace @vue-skuilder/express build`
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

## Current Status (Session 1 Complete)

### ✅ Completed Today
- Created shared `tsconfig.base.json` with ES2022 target and strict settings
- Migrated `common` and `db` packages to extend base configuration
- Fixed unused parameter strictness issue in common package
- Verified all builds and dev environment still work

### 🎯 Next Session Goals
- Add dual CommonJS/ESM exports to shared libraries
- Update express package to use base config
- Fix e2e-db Jest import issues
- Complete backend TypeScript standardization

### 📊 Progress Metrics
- **Packages Standardized**: 2/4 backend packages (common, db)
- **Build Status**: ✅ All packages building successfully
- **Dev Environment**: ✅ yarn dev working
- **Type Consistency**: ✅ ES2022 target across standardized packages