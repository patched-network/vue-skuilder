# @vue-skuilder/e2e-pipeline Package

End-to-end testing package for navigation pipeline and session controller behavior.

## Roadmap

See **[TODO.md](./TODO.md)** for the test roadmap - what interactions we want to script and assert against.

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

## Commands
- Test all: `yarn workspace @vue-skuilder/e2e-pipeline test`
- Test watch: `yarn workspace @vue-skuilder/e2e-pipeline test:watch`
- Test pipeline: `yarn workspace @vue-skuilder/e2e-pipeline test:pipeline`

## Architecture

### Test Categories

1. **Pipeline Tests** (`tests/pipeline/`)
   - Real CouchDB with cards and strategies
   - Real DataLayerProvider and Pipeline execution
   - Real navigator behavior (ELO, hierarchy, etc.)

### Harness Components

- **real-db.ts** - CouchDB setup, teardown, and test data insertion
- **test-db.ts** - PouchDB lifecycle utilities
- **mcp-client.ts** - Real MCP client wrapper for tool/resource access
- **determinism.ts** - Seeded randomness for reproducible tests

## Testing Pattern

See `tests/pipeline/hierarchy-filter-e2e.test.ts` for the canonical E2E test pattern:

```typescript
// Setup real database
await insertTestCourseConfig(courseId);
await insertTestDesignDocs(courseId);
await insertTestCard(courseId, { ... });
await insertTestStrategy(courseId, { ... });

// Initialize real data layer
const dataLayer = await initializeDataLayer({
  type: 'couch',
  options: { ... },
});

// Use real components
const courseDB = dataLayer.getCourseDB(courseId);
const cards = await courseDB.getWeightedCards(10);

// Assert real behavior
expect(cards).toHaveLength(expectedCount);
```

## Prerequisites

CouchDB must be running for E2E tests:
```bash
yarn couchdb:start
```

## Dependencies
- `@vue-skuilder/db` - Database layer (Pipeline, strategies)
- `@vue-skuilder/common` - Shared types
- `@vue-skuilder/mcp` - MCP server for integration tests
- `pouchdb-adapter-memory` - In-memory database
- `vitest` - Test framework

## Path Aliases
- `@harness/*` → `src/harness/*`
