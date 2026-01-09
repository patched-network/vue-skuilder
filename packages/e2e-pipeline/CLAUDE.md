# @vue-skuilder/e2e-pipeline Package

End-to-end testing package for navigation pipeline and session controller behavior.

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

### Mocks

- **mock-source.ts** - Mock StudyContentSource
- **mock-user-db.ts** - Mock UserDBInterface

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
- `jest` - Test framework with ESM support

## Path Aliases
- `@harness/*` → `src/harness/*`
- `@fixtures/*` → `src/fixtures/*`
- `@mocks/*` → `src/mocks/*`
