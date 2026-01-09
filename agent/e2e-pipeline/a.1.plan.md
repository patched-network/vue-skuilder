# Plan: e2e-pipeline Testing Package

## Context

The project lacks automated testing for:
1. **Navigation strategy effectiveness** - Do hierarchy filters, ELO selection, and other strategies actually work as configured?
2. **SessionController behavior** - Known suspected bugs around failed card resurfacing
3. **MCP authoring hooks** - Do the new strategy MCP tools integrate correctly end-to-end?

Current testing gaps:
- `packages/e2e-db` never reached critical mass
- SessionController has no unit tests
- Pipeline/strategy logic is only tested implicitly through UI

## Goals

Create `packages/e2e-pipeline` to provide:
1. **Scripted MCP test fixtures** - Programmatically create courses, cards, strategies via MCP
2. **Pipeline-level strategy tests** - Assert `getWeightedCards()` returns expected order
3. **SessionController behavior tests** - Catch queue management bugs with deterministic inputs
4. **Fast feedback loop** - No Cypress, no browser, just Node.js + CouchDB

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        e2e-pipeline tests                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────────────┐    │
│  │ Test Setup  │───▶│  CouchDB    │◀───│  Pipeline / Session  │    │
│  │ (MCP Client)│    │ (ephemeral) │    │    (under test)      │    │
│  └─────────────┘    └─────────────┘    └──────────────────────┘    │
│        │                   │                      │                 │
│        │ create_card       │                      │                 │
│        │ create_strategy   │                      │                 │
│        ▼                   ▼                      ▼                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     Test Assertions                           │  │
│  │  • getWeightedCards() order matches strategy config           │  │
│  │  • Failed cards resurface correctly                           │  │
│  │  • Hierarchy unlocks progress as expected                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Package Scaffolding

#### 1.1 Create Package Structure

```
packages/e2e-pipeline/
├── package.json
├── tsconfig.json
├── jest.config.js
├── CLAUDE.md
├── src/
│   ├── index.ts                    # Exports for potential reuse
│   ├── harness/
│   │   ├── index.ts
│   │   ├── mcp-client.ts           # MCP client wrapper
│   │   ├── test-db.ts              # CouchDB lifecycle management
│   │   ├── data-layer-factory.ts   # Create DataLayerProvider for tests
│   │   └── determinism.ts          # Math.random seeding utilities
│   ├── fixtures/
│   │   ├── index.ts
│   │   ├── course-builder.ts       # Fluent API for building test courses
│   │   ├── strategy-templates.ts   # Common strategy configurations
│   │   └── card-templates.ts       # Common card patterns
│   └── mocks/
│       ├── index.ts
│       ├── mock-source.ts          # Mock StudyContentSource
│       └── mock-user-db.ts         # Mock UserDBInterface
└── tests/
    ├── setup.ts                    # Jest global setup
    ├── teardown.ts                 # Jest global teardown
    ├── pipeline/
    │   ├── assembly.test.ts        # PipelineAssembler tests
    │   ├── hierarchy-filter.test.ts
    │   ├── elo-selection.test.ts
    │   ├── srs-scheduling.test.ts
    │   └── strategy-weights.test.ts
    ├── session/
    │   ├── queue-probability.test.ts
    │   ├── failed-card-resurfacing.test.ts
    │   └── time-pressure.test.ts
    └── mcp-integration/
        ├── create-strategy.test.ts
        └── strategy-resources.test.ts
```

#### 1.2 Package Configuration

**package.json:**
```json
{
  "name": "@vue-skuilder/e2e-pipeline",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:pipeline": "jest tests/pipeline",
    "test:session": "jest tests/session",
    "test:mcp": "jest tests/mcp-integration"
  },
  "dependencies": {
    "@vue-skuilder/db": "workspace:*",
    "@vue-skuilder/common": "workspace:*",
    "@vue-skuilder/mcp": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "pouchdb": "^9.0.0",
    "pouchdb-adapter-memory": "^9.0.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "typescript": "~5.7.2"
  }
}
```

**jest.config.js:**
```javascript
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^@harness/(.*)$': '<rootDir>/src/harness/$1',
    '^@fixtures/(.*)$': '<rootDir>/src/fixtures/$1',
    '^@mocks/(.*)$': '<rootDir>/src/mocks/$1',
  },
  globalSetup: '<rootDir>/tests/setup.ts',
  globalTeardown: '<rootDir>/tests/teardown.ts',
  testTimeout: 30000,
};
```

---

### Phase 2: Test Harness Implementation

#### 2.1 Database Lifecycle (`src/harness/test-db.ts`)

```typescript
import PouchDB from 'pouchdb';
import memoryAdapter from 'pouchdb-adapter-memory';

PouchDB.plugin(memoryAdapter);

export interface TestDatabase {
  courseDB: PouchDB.Database;
  userDB: PouchDB.Database;
  cleanup: () => Promise<void>;
}

/**
 * Create ephemeral in-memory databases for a test.
 * No Docker required - fastest option for unit tests.
 */
export async function createMemoryTestDB(testId: string): Promise<TestDatabase> {
  const courseDB = new PouchDB(`test-course-${testId}`, { adapter: 'memory' });
  const userDB = new PouchDB(`test-user-${testId}`, { adapter: 'memory' });

  return {
    courseDB,
    userDB,
    cleanup: async () => {
      await courseDB.destroy();
      await userDB.destroy();
    }
  };
}

/**
 * Create real CouchDB databases for integration tests.
 * Requires Docker container running.
 */
export async function createCouchTestDB(
  testId: string,
  serverUrl = 'http://admin:password@localhost:5984'
): Promise<TestDatabase> {
  const courseDbName = `coursedb-test-${testId}-${Date.now()}`;
  const userDbName = `userdb-test-${testId}-${Date.now()}`;

  const courseDB = new PouchDB(`${serverUrl}/${courseDbName}`);
  const userDB = new PouchDB(`${serverUrl}/${userDbName}`);

  // Verify connection
  await courseDB.info();
  await userDB.info();

  return {
    courseDB,
    userDB,
    cleanup: async () => {
      await courseDB.destroy();
      await userDB.destroy();
    }
  };
}
```

#### 2.2 MCP Client Wrapper (`src/harness/mcp-client.ts`)

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

export class TestMCPClient {
  private client: Client;
  private transport: StdioClientTransport;

  async connect(mcpServerPath: string): Promise<void> {
    this.transport = new StdioClientTransport({
      command: 'node',
      args: [mcpServerPath],
    });

    this.client = new Client({ name: 'e2e-pipeline-tests' });
    await this.client.connect(this.transport);
  }

  async createCard(params: {
    shape: string;
    data: Record<string, unknown>;
    tags?: string[];
    elo?: { score: number };
  }): Promise<string> {
    const result = await this.client.callTool('create_card', params);
    return JSON.parse(result.content[0].text).cardId;
  }

  async createStrategy(params: {
    name: string;
    implementingClass: string;
    description: string;
    serializedData?: string;
    learnable?: { weight: number; confidence: number; sampleSize: number };
  }): Promise<string> {
    const result = await this.client.callTool('create_strategy', params);
    return JSON.parse(result.content[0].text).strategyId;
  }

  async readResource(uri: string): Promise<unknown> {
    const result = await this.client.readResource(uri);
    return JSON.parse(result.contents[0].text);
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }
}
```

#### 2.3 Determinism Utilities (`src/harness/determinism.ts`)

```typescript
/**
 * Seed Math.random() for deterministic tests.
 * Uses a simple LCG (Linear Congruential Generator).
 */
export function seedRandom(seed: number): () => void {
  let state = seed;

  const originalRandom = Math.random;

  Math.random = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  // Return restore function
  return () => {
    Math.random = originalRandom;
  };
}

/**
 * Create a sequence of predetermined random values.
 * Useful for testing specific probability branches.
 */
export function mockRandomSequence(values: number[]): () => void {
  let index = 0;
  const originalRandom = Math.random;

  Math.random = () => {
    const value = values[index % values.length];
    index++;
    return value;
  };

  return () => {
    Math.random = originalRandom;
  };
}
```

#### 2.4 Course Builder (`src/fixtures/course-builder.ts`)

```typescript
import { TestMCPClient } from '@harness/mcp-client';

export class CourseBuilder {
  private cards: Array<{
    shape: string;
    data: Record<string, unknown>;
    tags: string[];
    elo?: number;
  }> = [];

  private strategies: Array<{
    name: string;
    implementingClass: string;
    serializedData?: string;
  }> = [];

  addCard(
    shape: string,
    data: Record<string, unknown>,
    tags: string[] = [],
    elo?: number
  ): this {
    this.cards.push({ shape, data, tags, elo });
    return this;
  }

  addFillInCard(prompt: string, answer: string, tags: string[] = []): this {
    return this.addCard('fillIn', { prompt, answer }, tags);
  }

  addHierarchyStrategy(
    name: string,
    levels: string[],
    unlockThreshold = 0.8
  ): this {
    this.strategies.push({
      name,
      implementingClass: 'hierarchyDefinition',
      serializedData: JSON.stringify({ levels, unlockThreshold }),
    });
    return this;
  }

  addEloStrategy(name: string, options?: { targetRange?: number }): this {
    this.strategies.push({
      name,
      implementingClass: 'elo',
      serializedData: options ? JSON.stringify(options) : undefined,
    });
    return this;
  }

  async build(client: TestMCPClient): Promise<{
    cardIds: string[];
    strategyIds: string[];
  }> {
    const cardIds: string[] = [];
    const strategyIds: string[] = [];

    for (const card of this.cards) {
      const id = await client.createCard({
        shape: card.shape,
        data: card.data,
        tags: card.tags,
        elo: card.elo ? { score: card.elo } : undefined,
      });
      cardIds.push(id);
    }

    for (const strategy of this.strategies) {
      const id = await client.createStrategy({
        name: strategy.name,
        implementingClass: strategy.implementingClass,
        description: `Test strategy: ${strategy.name}`,
        serializedData: strategy.serializedData,
      });
      strategyIds.push(id);
    }

    return { cardIds, strategyIds };
  }
}
```

---

### Phase 3: Pipeline Strategy Tests

#### 3.1 Hierarchy Filter Test (`tests/pipeline/hierarchy-filter.test.ts`)

```typescript
import { createMemoryTestDB, TestDatabase } from '@harness/test-db';
import { CourseBuilder } from '@fixtures/course-builder';
import { PipelineAssembler } from '@vue-skuilder/db/core/navigators';

describe('Hierarchy Filter Strategy', () => {
  let testDB: TestDatabase;
  let courseDB: CourseDBInterface;
  let userDB: UserDBInterface;

  beforeEach(async () => {
    testDB = await createMemoryTestDB('hierarchy');
    // Initialize course and user DB wrappers...
  });

  afterEach(async () => {
    await testDB.cleanup();
  });

  it('filters cards to current hierarchy level only', async () => {
    // Setup: Create course with hierarchy
    const builder = new CourseBuilder()
      .addFillInCard('Q1', 'A1', ['level-1', 'basics'])
      .addFillInCard('Q2', 'A2', ['level-2', 'intermediate'])
      .addFillInCard('Q3', 'A3', ['level-3', 'advanced'])
      .addHierarchyStrategy('test-hierarchy', ['level-1', 'level-2', 'level-3']);

    await builder.build(/* ... */);

    // Act: Assemble pipeline and get cards
    const pipeline = await PipelineAssembler.assemble({
      course: courseDB,
      user: userDB,
      strategies: await courseDB.getAllNavigationStrategies(),
    });

    const cards = await pipeline.getWeightedCards(10);

    // Assert: New user only sees level-1
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every(c => c.tags?.includes('level-1'))).toBe(true);
    expect(cards.some(c => c.tags?.includes('level-2'))).toBe(false);
  });

  it('unlocks next level after mastery threshold', async () => {
    // Setup: Same course, but user has mastered level-1
    // ... create course ...

    // Simulate mastery of level-1 cards
    await simulateUserMastery(userDB, courseDB, 'level-1', 0.85);

    const pipeline = await PipelineAssembler.assemble({ /* ... */ });
    const cards = await pipeline.getWeightedCards(10);

    // Assert: Now includes level-2
    expect(cards.some(c => c.tags?.includes('level-2'))).toBe(true);
  });
});
```

#### 3.2 ELO Selection Test (`tests/pipeline/elo-selection.test.ts`)

```typescript
describe('ELO Selection Strategy', () => {
  it('prioritizes cards near user ELO', async () => {
    const builder = new CourseBuilder()
      .addFillInCard('Easy', 'A', ['easy'], 800)
      .addFillInCard('Medium', 'B', ['medium'], 1200)
      .addFillInCard('Hard', 'C', ['hard'], 1600)
      .addEloStrategy('elo-navigator');

    await builder.build(/* ... */);

    // User has ELO ~1200
    await setUserElo(userDB, courseId, 1200);

    const pipeline = await PipelineAssembler.assemble({ /* ... */ });
    const cards = await pipeline.getWeightedCards(10);

    // Assert: Medium card has highest weight
    const mediumCard = cards.find(c => c.tags?.includes('medium'));
    const easyCard = cards.find(c => c.tags?.includes('easy'));
    const hardCard = cards.find(c => c.tags?.includes('hard'));

    expect(mediumCard?.score).toBeGreaterThan(easyCard?.score || 0);
    expect(mediumCard?.score).toBeGreaterThan(hardCard?.score || 0);
  });
});
```

---

### Phase 4: SessionController Behavior Tests

#### 4.1 Queue Probability Bug Test (`tests/session/queue-probability.test.ts`)

```typescript
import { SessionController } from '@vue-skuilder/db/study';
import { mockRandomSequence } from '@harness/determinism';

describe('SessionController queue probability', () => {
  let restoreRandom: () => void;

  afterEach(() => {
    restoreRandom?.();
  });

  it('BUG: failed cards starved when reviewQ empty', async () => {
    // This test documents the current buggy behavior
    // Math.random() = 0.5, availableTime > 20
    // Expected: failedQ gets fair share
    // Actual: failedQ only gets 10% (bug)

    restoreRandom = mockRandomSequence([0.5]);

    const session = new SessionController(
      [mockSourceWithNoReviews],
      300, // 5 min
      mockDataLayer,
      () => null
    );

    await session.prepareSession();

    // Show first card, mark as failed
    let card = await session.nextCard();
    card = await session.nextCard('marked-failed');

    // Track how often failed card resurfaces
    const sequence: string[] = [];
    for (let i = 0; i < 20; i++) {
      sequence.push(card?.item.cardID || 'null');
      card = await session.nextCard('dismiss-success');
    }

    const failedAppearances = sequence.filter(id => id === 'failed-card-id').length;

    // Current buggy behavior: very few appearances
    // This test will fail once the bug is fixed
    expect(failedAppearances).toBeLessThan(5); // Bug: should be higher
  });

  it('EXPECTED: failed cards surface fairly when reviewQ empty', async () => {
    // This test describes expected behavior after fix
    // When reviewQ is empty, failedQ should share probability with newQ

    restoreRandom = mockRandomSequence([0.5]);

    // ... same setup ...

    const failedAppearances = /* ... */;

    // After fix: failed cards should appear ~50% of the time
    // when only newQ and failedQ have items
    expect(failedAppearances).toBeGreaterThanOrEqual(8);
  });
});
```

#### 4.2 Failed Card Resurfacing Test (`tests/session/failed-card-resurfacing.test.ts`)

```typescript
describe('SessionController failed card resurfacing', () => {
  it('re-queues card after second failure', async () => {
    restoreRandom = mockRandomSequence([0.99]); // Always pick failedQ

    const session = new SessionController(/* ... */);
    await session.prepareSession();

    // Show card, fail it
    let card = await session.nextCard();
    const failedCardId = card?.item.cardID;
    card = await session.nextCard('marked-failed');

    // Force failedQ selection, fail again
    card = await session.nextCard(); // Should be the failed card
    expect(card?.item.cardID).toBe(failedCardId);

    card = await session.nextCard('marked-failed'); // Fail again

    // Card should still be in failedQ
    const debugInfo = session.getDebugInfo();
    expect(debugInfo.failedQueue.length).toBe(1);
    expect(debugInfo.failedQueue.items[0].cardID).toBe(failedCardId);
  });

  it('removes card from failedQ after success', async () => {
    restoreRandom = mockRandomSequence([0.99]);

    const session = new SessionController(/* ... */);
    await session.prepareSession();

    // Show card, fail it, then succeed
    let card = await session.nextCard();
    const cardId = card?.item.cardID;

    card = await session.nextCard('marked-failed');
    card = await session.nextCard(); // Failed card again
    card = await session.nextCard('dismiss-failed'); // Success after failure

    // Card should be removed from failedQ
    const debugInfo = session.getDebugInfo();
    const stillInFailed = debugInfo.failedQueue.items.some(
      i => i.cardID === cardId
    );
    expect(stillInFailed).toBe(false);
  });
});
```

---

### Phase 5: MCP Integration Tests

#### 5.1 Strategy Creation Test (`tests/mcp-integration/create-strategy.test.ts`)

```typescript
describe('MCP create_strategy integration', () => {
  let client: TestMCPClient;
  let testDB: TestDatabase;

  beforeAll(async () => {
    testDB = await createCouchTestDB('mcp-strategy');
    client = new TestMCPClient();
    await client.connect('./packages/mcp/dist/index.js');
  });

  afterAll(async () => {
    await client.disconnect();
    await testDB.cleanup();
  });

  it('creates strategy accessible via Pipeline', async () => {
    // Create strategy via MCP
    const strategyId = await client.createStrategy({
      name: 'test-hierarchy',
      implementingClass: 'hierarchyDefinition',
      description: 'Test hierarchy for e2e',
      serializedData: JSON.stringify({
        levels: ['beginner', 'intermediate', 'advanced'],
        unlockThreshold: 0.75,
      }),
    });

    expect(strategyId).toMatch(/^NAVIGATION_STRATEGY-/);

    // Verify via MCP resource
    const strategies = await client.readResource('strategies://all');
    expect(strategies.strategies).toContainEqual(
      expect.objectContaining({
        _id: strategyId,
        implementingClass: 'hierarchyDefinition',
      })
    );

    // Verify Pipeline can use it
    const pipeline = await PipelineAssembler.assemble({
      course: courseDB,
      user: userDB,
      strategies: await courseDB.getAllNavigationStrategies(),
    });

    // Pipeline should have hierarchy filter
    const cards = await pipeline.getWeightedCards(10);
    // ... assertions about filtering behavior
  });
});
```

---

## Success Criteria

1. **Package builds and tests run** via `yarn workspace @vue-skuilder/e2e-pipeline test`
2. **Pipeline tests cover**:
   - Hierarchy filter progression
   - ELO selection weighting
   - Strategy weight contributions
3. **SessionController tests cover**:
   - Queue probability bug (documented)
   - Failed card resurfacing
   - Time pressure behavior
4. **MCP integration tests verify**:
   - `create_strategy` creates usable strategies
   - Resources return accurate data
5. **Tests are deterministic** via seeded randomness
6. **Fast execution** (<30s for full suite with in-memory DB)

---

## Known Risks

### Risk 1: PouchDB Memory Adapter Fidelity

**Issue:** In-memory PouchDB might behave differently than CouchDB for edge cases.

**Mitigation:**
- Use memory adapter for unit tests (fast)
- Use real CouchDB for integration tests (accurate)
- Tag tests: `@memory` vs `@couch`

### Risk 2: MCP Server Lifecycle in Tests

**Issue:** Starting/stopping MCP server per test is slow.

**Mitigation:**
- Use shared server for test suite (beforeAll/afterAll)
- Or create `CourseDBInterface` directly without MCP for pure db tests
- Reserve MCP tests for integration layer only

### Risk 3: DataLayer Factory Complexity

**Issue:** Creating `DataLayerProvider` for tests requires wiring up multiple interfaces.

**Mitigation:**
- Create `TestDataLayerFactory` that handles boilerplate
- Or test at lower level (CourseDB/UserDB directly) where possible

---

## File Checklist

### New Package Files
- [x] `packages/e2e-pipeline/package.json`
- [x] `packages/e2e-pipeline/tsconfig.json`
- [x] `packages/e2e-pipeline/jest.config.js`
- [x] `packages/e2e-pipeline/CLAUDE.md`
- [x] `packages/e2e-pipeline/src/index.ts`

### Harness Files
- [x] `src/harness/index.ts`
- [x] `src/harness/test-db.ts`
- [x] `src/harness/mcp-client.ts`
- [x] `src/harness/data-layer-factory.ts`
- [x] `src/harness/determinism.ts`

### Fixture Files
- [x] `src/fixtures/index.ts`
- [x] `src/fixtures/course-builder.ts`
- [x] `src/fixtures/strategy-templates.ts`
- [x] `src/fixtures/card-templates.ts`

### Mock Files
- [x] `src/mocks/index.ts`
- [x] `src/mocks/mock-source.ts`
- [x] `src/mocks/mock-user-db.ts`

### Test Files
- [x] `tests/setup.ts`
- [x] `tests/teardown.ts`
- [x] `tests/pipeline/assembly.test.ts`
- [x] `tests/pipeline/hierarchy-filter.test.ts`
- [x] `tests/pipeline/elo-selection.test.ts`
- [x] `tests/session/queue-probability.test.ts`
- [x] `tests/session/failed-card-resurfacing.test.ts`
- [x] `tests/mcp-integration/create-strategy.test.ts`

### Modified Files
- [ ] Root `package.json` - add workspace (auto-detected by yarn)
- [ ] Root `tsconfig.json` - add reference (if using project references)
- [ ] `packages/db/docs/navigators-architecture.md` - add Testing section

### CI/CD Files
- [ ] `.github/workflows/ci-e2e-pipeline.yml` - GitHub Actions workflow

## Implementation Progress

### Phase 1: Package Scaffolding ✅ COMPLETE
- Created package directory structure
- Added package.json with jest, ts-jest, pouchdb dependencies
- Added tsconfig.json with path aliases
- Added jest.config.js with ESM support
- Added CLAUDE.md with package documentation

### Phase 2: Test Harness Implementation ✅ COMPLETE
- `test-db.ts`: Memory and CouchDB database lifecycle management
- `mcp-client.ts`: MCP client wrapper for tool/resource access
- `data-layer-factory.ts`: TestCourseDB, TestUserDB, TestDataLayerProvider
- `determinism.ts`: seedRandom, mockRandomSequence, tracking utilities

### Phase 3: Pipeline Strategy Tests ✅ COMPLETE
- `assembly.test.ts`: Strategy classification, storage, CourseBuilder integration
- `hierarchy-filter.test.ts`: Hierarchy configuration, card-level association
- `elo-selection.test.ts`: ELO strategy configuration, gradient cards

### Phase 4: SessionController Behavior Tests ✅ COMPLETE
- `queue-probability.test.ts`: Documents probability thresholds and bug scenarios
- `failed-card-resurfacing.test.ts`: Documents failed card queue behavior

### Phase 5: MCP Integration Tests ✅ COMPLETE
- `create-strategy.test.ts`: Strategy creation, retrieval, Pipeline preparation

### Remaining Work
- [ ] Run `yarn install` to update workspaces
- [ ] Run tests to verify compilation
- [ ] Fix any TypeScript/Jest configuration issues
- [x] Add CI/CD workflow

---

## Resolved Decisions

| Question | Decision |
|----------|----------|
| Reuse e2e-db? | No - ground-up is cleaner |
| Test DB approach? | Memory adapter for unit, CouchDB for integration |
| MCP server lifecycle? | Shared per suite, not per test |
| Initial scope? | Pipeline-level first, then SessionController |
| Randomness handling? | Seeded LCG + mock sequences |
