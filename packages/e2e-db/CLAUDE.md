# @vue-skuilder/e2e-db Package

End-to-end tests for database layer public API compliance and integration testing.

## Commands
- Test: `yarn workspace @vue-skuilder/e2e-db test` (Jest)
- Test with watch: `yarn workspace @vue-skuilder/e2e-db test:watch`
- Test with coverage: `yarn workspace @vue-skuilder/e2e-db test:coverage`
- Full E2E cycle: `yarn workspace @vue-skuilder/e2e-db test:e2e` (starts/stops CouchDB)
- Database management: `yarn workspace @vue-skuilder/e2e-db db:start|stop`
- Lint: `yarn workspace @vue-skuilder/e2e-db lint:fix`
- Type check: `yarn workspace @vue-skuilder/e2e-db type-check`

## Testing Framework
- **Framework**: Jest with TypeScript support
- **Environment**: Node.js with CouchDB integration
- **Setup**: Automatic database lifecycle management

## Dependencies
- `@vue-skuilder/common` - Shared types
- `@vue-skuilder/db` - Database layer under test
- `nano` - Direct CouchDB operations
- `pouchdb` - Client-side database testing
- `fs-extra` - File system utilities for test data

## Test Categories

### Interface Compliance
- **User DB Interface**: Tests public API contracts (`tests/interface-compliance/`)
- Ensures all database providers implement expected interfaces correctly

### Regression Tests  
- **Scheduled Review Removal**: Tests for data consistency bugs (`tests/regression/`)
- Prevents reintroduction of known issues

### Static Data Layer
- **Chunk Routing**: Tests static data provider routing logic
- **Smoke Tests**: Basic functionality verification

### Smoke Tests
- **Basic Operations**: Database connection, CRUD operations
- **Integration**: Multi-provider compatibility testing

## CouchDB Requirements
Tests require a running CouchDB instance. The test suite can automatically manage the database lifecycle using the parent project's CouchDB scripts.

## Test Data Management
- **Test Data Factory**: Generates consistent test datasets (`helpers/test-data-factory.ts`)
- **Raw CouchDB Helper**: Direct database operations for setup/teardown (`helpers/raw-couch.ts`)
- **Test Utilities**: Common testing patterns and assertions (`helpers/test-utils.ts`)