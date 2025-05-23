# E2E Database Testing Package

This package provides end-to-end testing for the `@vue-skuilder/db` package public API against a live CouchDB instance.

## Purpose

- **Public API Testing**: Tests only the exported interfaces and functions from `@vue-skuilder/db`
- **Real Database Verification**: Uses raw CouchDB connections to verify actual database state changes
- **Bug Prevention**: Catches interface/implementation mismatches and data persistence issues
- **Consumer Perspective**: Tests from the viewpoint of packages that consume the DB layer

## Architecture

### Test Structure
```
src/
├── setup/
│   ├── database.ts          # CouchDB container management
│   └── jest-setup.ts        # Global test configuration
├── helpers/
│   ├── raw-couch.ts         # Direct CouchDB assertions
│   ├── test-data-factory.ts # Test data generation
│   └── test-utils.ts        # Common test utilities
└── tests/
    ├── regression/          # Bug prevention tests
    └── integration/         # Cross-package scenarios
```

### Public API Only
```typescript
// ✅ ALLOWED - Public API imports
import { initializeDataLayer, getDataLayer } from '@vue-skuilder/db';
import { UserDBInterface, CourseDBInterface } from '@vue-skuilder/db/core';

// ❌ FORBIDDEN - Implementation details
// import { User } from '@vue-skuilder/db/impl/pouch/userDB';
```

## Getting Started

### Prerequisites
- CouchDB test container running (handled automatically)
- Node.js 18+
- Yarn workspaces

### Running Tests

#### Quick Test Run
```bash
# From project root
yarn workspace @vue-skuilder/e2e-db test:e2e
```

#### Development Workflow
```bash
# Start CouchDB manually
yarn couchdb:start

# Run tests in watch mode
yarn workspace @vue-skuilder/e2e-db test:watch

# Stop CouchDB when done
yarn couchdb:stop
```

#### Individual Test Files
```bash
yarn workspace @vue-skuilder/e2e-db test -- scheduled-review-removal.test.ts
```

## Test Categories

### 1. Regression Tests
Located in `src/tests/regression/`

**Purpose**: Prevent specific bugs from reoccurring
**Example**: `scheduled-review-removal.test.ts` - Catches the `removeScheduledCardReview` interface mismatch

### 2. Integration Tests
Located in `src/tests/integration/`

**Purpose**: Test cross-package workflows and real usage patterns

### 3. Interface Compliance Tests
**Purpose**: Verify that public API contracts work as documented

## Raw Database Verification

This package's key innovation is verifying actual database state changes, not just API responses.

```typescript
// Schedule review via public API
await user.scheduleCardReview(testReview);

// Verify via public API
const reviews = await user.getPendingReviews();
expect(reviews).toHaveLength(1);

// ✨ CRITICAL: Verify in raw database
const rawCount = await rawCouch.getScheduledReviewCount(username);
expect(rawCount).toBe(1);

// Remove via public API
await user.removeScheduledCardReview(username, reviewId);

// ✨ CRITICAL: Verify actual removal from database
const finalCount = await rawCouch.getScheduledReviewCount(username);
expect(finalCount).toBe(0); // This would catch the bug!
```

## Test Data Management

### Factories
```typescript
const testUser = testDataFactory.createTestUser('prefix');
const testCourse = testDataFactory.createTestCourse('course-name');
const testReview = testDataFactory.createTestScheduledReview(username, courseId);
```

### Cleanup
- Automatic cleanup between tests
- Test databases are isolated
- Raw database verification ensures no test pollution

## Key Test Patterns

### Basic Interface Test
```typescript
it('should perform operation and persist to database', async () => {
  // Setup
  const { user, testUser, rawCouch } = await TestUtils.createUserTestContext(dataLayer, rawCouch);
  
  // Act via public API
  await user.someOperation(params);
  
  // Assert via public API
  const result = await user.getOperationResult();
  expect(result).toBeDefined();
  
  // Assert via raw database
  const rawResult = await rawCouch.verifyOperationInDatabase(testUser.username);
  expect(rawResult).toBe(true);
});
```

### Consumer Pattern Test
```typescript
it('reproduces exact platform-ui usage pattern', async () => {
  // Replicate exact imports and calls from platform-ui
  const dataLayer = await initializeDataLayer(config);
  const user = await dataLayer.getUserDB(username);
  
  // Use exact calling pattern from consuming package
  await user.removeScheduledCardReview(user.getUsername(), reviewId);
  
  // Verify it actually works
  const removed = await rawCouch.assertReviewRemoved(username, reviewId);
  expect(removed).toBe(true);
});
```

## Configuration

### Environment Variables
- Tests automatically use `localhost:5984` CouchDB instance
- No authentication required for test environment
- Databases prefixed with test identifiers for isolation

### Jest Configuration
- 30-second timeout for CouchDB operations
- ESM support for modern imports
- Custom matchers for database assertions

## Custom Jest Matchers

```typescript
// Check document existence
await expect({ username, documentId }).toExistInDatabase();

// Check document removal
await expect({ username, documentId }).toBeRemovedFromDatabase();

// Check scheduled review count
await expect(username).toHaveScheduledReviewCount(expectedCount);
```

## Contributing

### Adding New Tests

1. **Regression Tests**: When a bug is found, add a test in `regression/` that reproduces it
2. **Integration Tests**: When adding new features, test the complete workflow
3. **Public API Only**: Never import from implementation packages

### Test Naming Convention
- `*.test.ts` for test files
- Descriptive test names that explain the scenario
- Group related tests in `describe` blocks

### Database State Verification
Always verify both:
1. Public API responses (what the consumer sees)
2. Raw database state (what actually persisted)

## Troubleshooting

### CouchDB Connection Issues
```bash
# Check CouchDB status
yarn couchdb:status

# Restart if needed
yarn couchdb:stop && yarn couchdb:start
```

### Test Timeouts
- Increase timeout in Jest config if needed
- Check CouchDB container health
- Verify network connectivity to localhost:5984

### Database Cleanup Issues
- Tests automatically clean up between runs
- Manual cleanup: `yarn couchdb:remove && yarn couchdb:start`

## Examples

See the existing tests for patterns:
- `scheduled-review-removal.test.ts` - Interface mismatch detection
- More examples coming as the test suite grows

This package ensures the database layer works correctly for all consumers while maintaining clean architectural boundaries.