# @vue-skuilder/e2e-pipeline Package

End-to-end testing package for navigation pipeline and session controller behavior.

## Philosophy: Real Components, Not Mocks

**IMPORTANT:** This package exists to exercise **real framework components** together without browser frontends or Cypress-based testing. The goal is sanity and regression testing through **headless drivers** of the platform.

### What NOT to do in this package:
- **DO NOT create mocks, fakes, or stubs** - These defeat the purpose of E2E testing
- **DO NOT isolate components** - We want to test components working together
- **DO NOT create new mock implementations** - Use real `@vue-skuilder/db` components

### What TO do:
- Use **real CouchDB** via `src/harness/real-db.ts` helpers
- Use **real DataLayerProvider** and **real CourseDB** interfaces
- Use **real Pipeline** and **real navigators** (ELO, hierarchy, etc.)
- Use the **navigator registry** pattern to avoid dynamic import issues
- Use **determinism utilities** (seeded randomness) for reproducibility - this is fine

### Why this matters:
1. **Regression testing** - Catch real integration bugs, not mock mismatches
2. **Future-proofing** - Headless drivers may graduate to PaaS backends or AI tutoring services
3. **Confidence** - Tests that exercise real code give real confidence

### Existing mocks to be removed:
See `MOCKS_TO_REMOVE.md` for catalog of legacy mock code that should be replaced with real implementations.

## Commands
- Test all: `yarn workspace @vue-skuilder/e2e-pipeline test`
- Test watch: `yarn workspace @vue-skuilder/e2e-pipeline test:watch`
- Test pipeline: `yarn workspace @vue-skuilder/e2e-pipeline test:pipeline`
- Test session: `yarn workspace @vue-skuilder/e2e-pipeline test:session`
- Test MCP integration: `yarn workspace @vue-skuilder/e2e-pipeline test:mcp`

## Architecture

### Test Categories

1. **Pipeline Tests** (`tests/pipeline/`)
   - Strategy assembly and composition
   - Hierarchy filter progression
   - ELO selection weighting
   - Generator/filter interactions

2. **Session Tests** (`tests/session/`)
   - Queue probability behavior
   - Failed card resurfacing
   - Time pressure handling

3. **MCP Integration Tests** (`tests/mcp-integration/`)
   - Strategy creation via MCP tools
   - Resource access verification
   - End-to-end authoring workflows

### Harness Components

- **test-db.ts** - Database lifecycle (memory and CouchDB adapters)
- **mcp-client.ts** - MCP client wrapper for tool/resource access
- **determinism.ts** - Seeded randomness for reproducible tests
- **data-layer-factory.ts** - DataLayerProvider setup for tests

### Fixtures

- **course-builder.ts** - Fluent API for constructing test courses
- **strategy-templates.ts** - Common strategy configurations
- **card-templates.ts** - Common card patterns

### Mocks (DEPRECATED - to be removed)

These mock implementations are legacy and should be replaced with real component testing:
- **mock-source.ts** - Mock StudyContentSource → use real Pipeline
- **mock-user-db.ts** - Mock UserDBInterface → use real UserDB with CouchDB

## Testing Strategy

### Database Modes
- **Memory adapter**: Fast unit tests, no Docker required
- **CouchDB adapter**: Integration tests, requires Docker container

### Determinism
Tests use seeded randomness via `seedRandom()` or `mockRandomSequence()` to ensure reproducibility.

### Assertions
- Pipeline output ordering matches strategy configuration
- Card scoring follows documented algorithms
- Queue management follows expected probability distributions

## Dependencies
- `@vue-skuilder/db` - Database layer (Pipeline, strategies)
- `@vue-skuilder/common` - Shared types
- `@vue-skuilder/mcp` - MCP server for integration tests
- `pouchdb-adapter-memory` - In-memory database for fast tests
- `vitest` - Test framework (migrated from Jest for better ESM support)

## Path Aliases
- `@harness/*` → `src/harness/*`
- `@fixtures/*` → `src/fixtures/*`
- `@mocks/*` → `src/mocks/*`
