# TODO: Strategy-Specific State Storage in UserDB

## Status: NOT STARTED

## Goal

Enable NavigationStrategies (ContentNavigators) to persist their own state data in the
user's database, allowing strategies to maintain context across sessions.

## Current State

### What Strategies Can Read

| Data | Method | Notes |
|------|--------|-------|
| User's global ELO | `user.getCourseRegDoc(courseId).elo.global` | ✅ Available |
| User's per-tag ELO | `user.getCourseRegDoc(courseId).elo.tags` | ✅ Available |
| Seen cards | `user.getSeenCards(courseId)` | ✅ Card IDs only |
| Active cards | `user.getActiveCards()` | ✅ Available |
| Pending reviews | `user.getPendingReviews(courseId)` | ✅ ScheduledCard objects |
| Card history | `user.putCardRecord()` returns `CardHistory` | 🟡 Only after write |

### What Strategies Cannot Do

- **Store arbitrary state**: No namespaced storage for strategy-specific data
- **Track temporal patterns**: No easy way to record "when did I last introduce tag X?"
- **Persist learning context**: Strategy state is lost between sessions

## Use Cases

### 1. InterferenceMitigator

**Need**: Track when interfering concepts were last introduced together.

```typescript
// Desired: Store last introduction time per tag
{
  "lastIntroduction": {
    "letter-b": "2024-01-15T10:30:00Z",
    "letter-d": "2024-01-16T14:20:00Z"
  }
}
```

### 2. Minimal Pairs Strategy (Future)

**Need**: Track discrimination training progress between confusable pairs.

```typescript
// Desired: Store discrimination scores per pair
{
  "pairScores": {
    "b-d": { "correct": 15, "total": 20, "lastPracticed": "..." },
    "m-n": { "correct": 8, "total": 10, "lastPracticed": "..." }
  }
}
```

### 3. Adaptive Pacing Strategy (Future)

**Need**: Track user's engagement patterns and optimal session timing.

```typescript
// Desired: Store engagement metrics
{
  "sessionMetrics": {
    "avgAccuracyByTimeOfDay": { "morning": 0.85, "afternoon": 0.78 },
    "optimalSessionLength": 180,  // seconds
    "fatigueThreshold": 12        // cards before accuracy drops
  }
}
```

## Proposed Solutions

### Option A: Extend CourseRegistration

Add a `strategyState` field to the existing `CourseRegistration` document.

**Schema:**
```typescript
interface CourseRegistration {
  // ... existing fields ...
  
  /**
   * Strategy-specific state, keyed by strategy ID or type.
   * Each strategy owns its own namespace.
   */
  strategyState?: {
    [strategyKey: string]: unknown;
  };
}
```

**Pros:**
- No new document types
- Lives alongside other course-specific user data
- Already synced via existing mechanisms

**Cons:**
- Potential for large documents if strategies store lots of data
- All strategies share one document (contention on updates)

---

### Option B: Separate Strategy State Documents

Create a new document type for strategy state.

**Schema:**
```typescript
interface StrategyStateDoc {
  _id: `STRATEGY_STATE-${courseId}-${strategyKey}`;
  docType: DocType.STRATEGY_STATE;
  courseId: string;
  strategyKey: string;  // e.g., "interferenceMitigator" or strategy instance ID
  data: unknown;
  updatedAt: string;
}
```

**Pros:**
- Clean separation
- No document size concerns
- Independent updates (no contention)

**Cons:**
- New document type to manage
- More queries to fetch state

---

### Option C: Generic Key-Value Store in UserDB

Add generic methods for namespaced storage.

**Interface:**
```typescript
interface UserDBWriter {
  // ... existing methods ...
  
  /**
   * Store data in a namespaced location.
   * @param namespace - Unique namespace (e.g., "strategy:interferenceMitigator:course123")
   * @param data - Arbitrary JSON-serializable data
   */
  putNamespacedData(namespace: string, data: unknown): Promise<void>;
  
  /**
   * Retrieve namespaced data.
   * @param namespace - The namespace to retrieve
   * @returns The stored data, or null if not found
   */
  getNamespacedData<T>(namespace: string): Promise<T | null>;
  
  /**
   * Delete namespaced data.
   * @param namespace - The namespace to delete
   */
  deleteNamespacedData(namespace: string): Promise<void>;
}
```

**Pros:**
- Most flexible
- Reusable beyond strategies
- Clean API

**Cons:**
- Very generic (might be too permissive)
- Namespace collision risk

---

## Recommended Approach

**Option B (Separate Documents)** with a convenience wrapper:

```typescript
// In ContentNavigator base class or a mixin
abstract class ContentNavigator {
  // ... existing methods ...
  
  /**
   * Get this strategy's persisted state for the current course.
   */
  protected async getStrategyState<T>(): Promise<T | null> {
    const key = `STRATEGY_STATE-${this.course.getCourseID()}-${this.strategyKey}`;
    try {
      return await this.user.get<T>(key);
    } catch (e) {
      return null;  // Not found
    }
  }
  
  /**
   * Persist this strategy's state for the current course.
   */
  protected async putStrategyState<T>(data: T): Promise<void> {
    const key = `STRATEGY_STATE-${this.course.getCourseID()}-${this.strategyKey}`;
    const existing = await this.getStrategyState<T>();
    await this.user.put({
      _id: key,
      _rev: existing?._rev,
      docType: DocType.STRATEGY_STATE,
      courseId: this.course.getCourseID(),
      strategyKey: this.strategyKey,
      data,
      updatedAt: new Date().toISOString(),
    });
  }
  
  /**
   * Unique key for this strategy instance.
   * Override in subclasses if multiple instances need separate state.
   */
  protected get strategyKey(): string {
    return this.constructor.name;  // e.g., "InterferenceMitigatorNavigator"
  }
}
```

## Implementation Plan

### Phase 1: Add DocType and Interface

1. Add `STRATEGY_STATE` to `DocType` enum in `packages/db/src/core/types/types-legacy.ts`
2. Define `StrategyStateDoc` interface
3. Add prefix to `DocTypePrefixes`

### Phase 2: Add UserDB Methods

1. Add `getStrategyState()` and `putStrategyState()` to `UserDBInterface`
2. Implement in `CouchUserDB`

### Phase 3: Add ContentNavigator Helpers

1. Add protected helper methods to `ContentNavigator` base class
2. Document usage pattern

### Phase 4: Update Strategies

1. Update `InterferenceMitigatorNavigator` to use state storage
2. Add tests for state persistence

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `packages/db/src/core/types/types-legacy.ts` | MODIFY | Add STRATEGY_STATE DocType |
| `packages/db/src/core/types/strategyState.ts` | CREATE | StrategyStateDoc interface |
| `packages/db/src/core/interfaces/userDB.ts` | MODIFY | Add state storage methods |
| `packages/db/src/impl/couch/userDB.ts` | MODIFY | Implement state storage |
| `packages/db/src/core/navigators/index.ts` | MODIFY | Add helper methods to base class |
| `packages/db/src/core/navigators/interferenceMitigator.ts` | MODIFY | Use state storage |

## Test Cases

1. **Store and retrieve**: Write state, read it back, verify equality
2. **Update existing**: Write state, update it, verify new value
3. **Separate namespaces**: Two strategies store data, each gets their own
4. **Cross-session persistence**: Store state, simulate new session, verify data persists
5. **Missing state**: Read state that doesn't exist, get null (not error)

## Open Questions

1. **State migration**: How to handle strategy state when strategy config changes?
2. **State cleanup**: When a strategy is deleted, should its state be cleaned up?
3. **State size limits**: Should we enforce maximum state size?
4. **Sync behavior**: How does state sync across devices for multi-device users?

## Related Files

- `packages/db/src/core/interfaces/userDB.ts` — UserDB interface
- `packages/db/src/impl/couch/userDB.ts` — UserDB implementation
- `packages/db/src/core/navigators/index.ts` — ContentNavigator base class
- `packages/db/src/core/types/types-legacy.ts` — DocType enum
- `packages/db/docs/navigators-architecture.md` — Architecture overview