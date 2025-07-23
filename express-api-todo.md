# Express API Refactoring Todo

## Phase 1: Add Programmatic API (Foundation)

### 1.1 Create Configuration Interface
- [x] Create `src/types.ts` with `ExpressServerConfig` interface
- [x] Define configuration structure for CouchDB, ports, CORS, etc.
- [x] Add TypeScript types for all configuration options

**Summary**: Created comprehensive type definitions including:
- `ExpressServerConfig` - Main interface for programmatic usage with CouchDB config, optional port, version, nodeEnv, CORS settings
- `EnvironmentConfig` - Internal bridge type for existing env var usage
- `ServerStartResult` - Return type for server startup with port/URL info
- Full JSDoc documentation for all interfaces and properties

### 1.2 Extract App Creation Logic
- [x] **Keep existing `src/app.ts` unchanged** (platform usage)
- [x] Create `src/app-factory.ts` with shared Express app creation logic
- [x] Extract common app setup code from existing `src/app.ts`
- [x] Ensure both standalone and programmatic modes use same logic

**Summary**: Created `app-factory.ts` with shared Express app creation logic:
- `createExpressApp(config)` - Accepts both ExpressServerConfig and EnvironmentConfig
- `initializeServices()` - Extracted async initialization logic for background services
- Type guards to handle dual configuration formats (programmatic vs env vars)
- Config conversion utilities to bridge between formats
- All routes and middleware extracted from original app.ts
- VueClientRequest interface moved to factory for shared usage

### 1.2b Refactor Existing App to Use Factory
- [x] Refactor `src/app.ts` to use `createExpressApp()` from app-factory
- [x] Replace duplicated middleware/routes with factory function call
- [x] Use `initializeServices()` instead of inline init() function
- [x] Ensure existing platform behavior unchanged
- [x] Test that `yarn dev` still works correctly

**Summary**: Completely refactored standalone app.ts to eliminate duplication:
- Reduced from ~264 lines to ~32 lines (87% reduction)
- Uses `createExpressApp(ENV)` with environment config
- Uses `initializeServices()` for background initialization
- Preserves original port (3000), logging, and error handling behavior
- Both modes now guaranteed to use identical Express configuration and routes

**Note**: This eliminates code duplication and ensures both standalone and programmatic modes use identical logic.

### 1.3 Révisée: Create Public API with Factory Functions
- [x] Create `src/index.ts` as main package entry point
- [x] Export `createExpressApp` and `initializeServices` functions
- [x] Export type definitions (`ExpressServerConfig`, `VueClientRequest`, etc.)
- [x] Update `package.json` main/types entries to point to index
- [x] Add exports map for subpath compatibility (`./app` for standalone usage)
- [x] Test build and verify API exports work correctly

**Summary**: Created clean factory-based public API:
- Main entry: `src/index.ts` with `createExpressApp()` and `initializeServices()` 
- Type exports: `ExpressServerConfig`, `VueClientRequest`, `AppConfig`, `ServerStartResult`
- Backwards compatibility: `./app` export for direct standalone server access
- Package.json updated: main/types point to dist/index.js/d.ts
- Build successful, dev mode still works correctly

### 1.4 Add Dual Configuration Support
- [ ] **Keep existing `src/utils/env.ts` unchanged** (platform usage)
- [ ] Add config object support to app factory
- [ ] Create utility to convert between env vars and config objects
- [ ] Ensure both configuration methods work with same app logic

## Phase 2: Package Structure (Exports)

### 2.1 Create Main Export File
- [ ] Create `src/index.ts` as main package entry point
- [ ] Export `SkuilderExpressServer` class
- [ ] Export `ExpressServerConfig` type
- [ ] Export `createExpressApp` function for advanced usage

### 2.2 Update Package Configuration
- [ ] Update `package.json` main entry to `dist/index.js`
- [ ] Update `package.json` types entry to `dist/index.d.ts`
- [ ] Add proper exports map for subpath exports
- [ ] Ensure backwards compatibility exports for `./app`

### 2.3 Platform Compatibility  
- [ ] Verify existing `src/app.ts` standalone execution still works
- [ ] Preserve current `yarn dev` behavior for monorepo usage
- [ ] Test that existing platform Express usage unchanged

## Phase 3: CLI Integration (Remove Embedding)

### 3.1 Update CLI Dependencies
- [ ] Add `@vue-skuilder/express` to CLI's `package.json` dependencies
- [ ] Remove Express from devDependencies (it was in there for embedding)
- [ ] Update CLI's TypeScript imports to use new API

### 3.2 Refactor Studio Command
- [ ] Replace `ExpressManager` embedded approach with direct import
- [ ] Update `src/commands/studio.ts` to use `SkuilderExpressServer`
- [ ] Pass CouchDB configuration dynamically to Express server
- [ ] Handle port assignment and URL reporting

### 3.3 Remove Embedding Infrastructure
- [ ] Remove `embed:express` script from CLI's `package.json`
- [ ] Remove `build:express` script from CLI's `package.json`
- [ ] Update main build script to exclude Express embedding
- [ ] Clean up `ExpressManager.js` utility (if no longer needed)

## Phase 4: Testing & Validation

### 4.1 Monorepo Testing
- [ ] Test Express server directly: `yarn workspace @vue-skuilder/express dev`
- [ ] Test CLI studio command in monorepo: `yarn studio`
- [ ] Verify CouchDB integration still works
- [ ] Verify all Express endpoints respond correctly

### 4.2 External Package Testing
- [ ] Build and publish packages locally for testing
- [ ] Test CLI via `npx` in external project directory
- [ ] Verify `yarn studio` works without embedding errors
- [ ] Test that all Express dependencies resolve correctly

### 4.3 Edge Case Testing
- [ ] Test multiple concurrent studio sessions (port conflicts)
- [ ] Test Express server shutdown and cleanup
- [ ] Test error handling for invalid configurations
- [ ] Verify memory leaks don't occur with start/stop cycles

## Phase 5: Documentation & Cleanup

### 5.1 Update Documentation
- [ ] Update Express package `CLAUDE.md` with new API usage
- [ ] Update CLI package `CLAUDE.md` with Express integration changes
- [ ] Document migration path for any external users
- [ ] Add JSDoc comments to public API methods

### 5.2 Code Cleanup
- [ ] Remove old embedded Express assets from CLI dist
- [ ] Clean up any unused utility files
- [ ] Update TypeScript build configs if needed
- [ ] Run linting and fix any issues

### 5.3 Version Management
- [ ] Coordinate version bumps for both Express and CLI packages
- [ ] Update `vtag.js` if needed for new dependency relationship
- [ ] Test that version transformations still work correctly

## Success Criteria

- [ ] CLI can be used via `npx @vue-skuilder/cli studio` without dependency errors
- [ ] Express server starts and stops programmatically via CLI
- [ ] All existing Express API endpoints work correctly
- [ ] Monorepo development workflow unchanged
- [ ] No increase in CLI package size (should decrease)
- [ ] Express server supports concurrent sessions with different ports
- [ ] Studio mode workflow functions end-to-end