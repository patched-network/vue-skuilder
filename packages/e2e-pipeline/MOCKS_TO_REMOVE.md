# Mocks to Remove from e2e-pipeline

This catalog lists mock/fake implementations that should be removed or replaced with real component testing. The goal of this package is **true E2E testing** using real framework components.

## Files to Delete

### `src/mocks/` directory (entire directory)

| File | What it mocks | Replacement approach |
|------|---------------|---------------------|
| `mock-source.ts` | `StudyContentSource` interface | Use real `Pipeline` from `@vue-skuilder/db` |
| `mock-user-db.ts` | `UserDBInterface` | Use real `UserDB` with CouchDB via `real-db.ts` helpers |
| `index.ts` | Re-exports mocks | Delete when mocks removed |

**Lines of code:** ~560 lines of mock code

### `src/harness/data-layer-factory.ts` (partial)

Contains `TestCourseDB`, `TestUserDB`, and `TestDataLayerProvider` - these are essentially in-memory fakes.

| Class | What it fakes | Replacement approach |
|-------|---------------|---------------------|
| `TestCourseDB` | Real CourseDB | Use real `initializeDataLayer()` with CouchDB |
| `TestUserDB` | Real UserDB | Use real user database via CouchDB |
| `TestDataLayerProvider` | Real DataLayerProvider | Use real `initializeDataLayer()` |

**Action:** Replace with `real-db.ts` approach. The memory adapter usage is fine for fast tests, but the fake classes bypass real framework logic.

## Tests to Rewrite

### `tests/session/queue-probability.test.ts`

**Current state:** Uses `MockStudyContentSource` and `MockUserDB` extensively
- 305 lines
- Imports: `createMockSource`, `createEmptyMockSource`, `createReviewMockSource`, `createMockUserDB`

**Problem:** Tests document expected behavior but don't actually exercise real `SessionController`

**Rewrite approach:**
1. Create real course in CouchDB with test cards
2. Use real `SessionController` from `@vue-skuilder/db`
3. Use determinism helpers (seeded random) to control probability outcomes
4. Assert against real session behavior

### `tests/session/failed-card-resurfacing.test.ts`

**Current state:** Uses `MockStudyContentSource` and `MockUserDB`
- 383 lines
- Imports: `createMockSource`, `createWeightedCard`, `createMockUserDB`, `MockUserDB`

**Problem:** Tests document expected failed card behavior but use mocks instead of real `SessionController`

**Rewrite approach:**
1. Create real course with cards in CouchDB
2. Initialize real `SessionController`
3. Simulate user interactions (answer wrong, answer right)
4. Assert failed queue behavior using real implementation

## Tests That Are Already Correct (Good Examples)

### `tests/pipeline/hierarchy-filter-e2e.test.ts`

This test is a **good example** of true E2E testing:
- Uses real CouchDB via `waitForCouchDB()`, `createTestCourseId()`, etc.
- Uses real `initializeDataLayer()` from `@vue-skuilder/db`
- Uses real `PipelineAssembler` and navigators
- Uses determinism helpers for reproducibility
- Properly cleans up test databases

**Pattern to follow:**
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

## Harness Code to Keep

| File | Purpose | Status |
|------|---------|--------|
| `src/harness/real-db.ts` | CouchDB setup helpers | **Keep** - Good E2E support |
| `src/harness/determinism.ts` | Seeded randomness | **Keep** - Essential for reproducibility |
| `src/harness/mcp-client.ts` | MCP client wrapper | **Keep** - For MCP integration tests |

## Fixture Code to Keep

| File | Purpose | Status |
|------|---------|--------|
| `src/fixtures/course-builder.ts` | Fluent API for test course setup | **Keep** - Helps set up real data |
| `src/fixtures/strategy-templates.ts` | Common strategy configs | **Keep** - Helps set up real strategies |
| `src/fixtures/card-templates.ts` | Common card patterns | **Keep** - Helps set up real cards |

## Migration Priority

1. **High:** Delete `src/mocks/` - ~560 lines of code that undermines E2E goals
2. **High:** Rewrite `tests/session/*.test.ts` - Currently don't test real behavior
3. **Medium:** Replace `TestCourseDB`/`TestUserDB` in `data-layer-factory.ts` with real implementations
4. **Low:** Consider if in-memory PouchDB tests add value or just duplicate CouchDB tests

## Notes

- The determinism utilities (`seedRandom`, `mockRandomSequence`) are **not mocks** - they control randomness for reproducibility, which is valid for testing
- The fixture builders are **not mocks** - they help construct real data for real databases
- CouchDB container must be running for true E2E tests: `yarn couchdb:start`
