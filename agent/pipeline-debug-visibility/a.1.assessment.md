# Assessment: Pipeline Debug Visibility

## Context

From the provided logs, we observe:
1. Two courses are being mixed in a study session
2. Course 1 (`a9fae15...` "Emily"): Uses `Composite Generator` with `Draft Priorities` filter → produced 50 → 20 cards
3. Course 2 (`f45162...` "Typing"): Uses `Composite Generator` with `ELO Distance Filter` → produced 3 → 3 cards
4. All 23 final cards are **new** cards (no reviews despite "scheduled reviews" being queried)
5. The pipeline logged execution summaries but the *why* is not transparent

### Specific Observations from Logs

```
[DB:INFO] [Pipeline] Configuration:
  Generator: Composite Generator
  Filters:
    - Draft Priorities
[DB:INFO] Fetching Alice's scheduled reviews for course a9fae15...
[DB:INFO] [Pipeline] Execution: Composite Generator produced 50 → 1 filters → 20 results (top scores: 1.00, 1.00, 0.99)
```

**Questions the logs don't answer:**
- Why were 0 reviews selected despite reviews being fetched?
- What scores did the SRS generator produce vs. the ELO generator?
- How did the filter transform the scores?
- What was the provenance trail for any given card?

## Current Debug Infrastructure

### 1. Console Logging (Pipeline.ts)
- `logPipelineConfig()` - Shows generator + filter names ✅
- `logExecutionSummary()` - Shows counts before/after filters ✅
- `logCardProvenance()` - Shows provenance for top 3 cards (debug level only)
- Tag hydration stats

**Limitation:** `logger.debug()` only shows in `NODE_ENV=development` - not in production builds.

### 2. SessionControllerDebug Component
- Shows queue states (review/new/failed counts and items)
- Shows hydrated cache state
- Activated via `window.debugMode = true`

**Limitation:** No visibility into *why* cards were selected, no provenance trails, no generator/filter breakdown.

### 3. getDebugInfo() API
- Returns queue snapshots
- No pipeline introspection

## Options for Improved Visibility

### Option A: Enhanced Debug Logging with Filter Tags

**Approach:** Add structured logging with filterable prefixes.

**Implementation:**
- Add `[Pipeline:Generator]`, `[Pipeline:Filter:xxx]`, `[Pipeline:Score]` prefixes
- Log per-generator output before aggregation
- Log score transformations per filter
- Promote critical info to `logger.info` level

**Pros:**
- Minimal code changes
- Works in console immediately
- Can grep/filter in browser dev tools

**Cons:**
- Can get very noisy
- No interactive exploration
- Logs lost when console clears
- Not available without rebuilding if you need different info

### Option B: Console-Accessible Debug Object (`window.skuilder.pipeline`)

**Approach:** Expose a global object that captures pipeline state for interactive querying.

**Implementation:**
```typescript
// In Pipeline.ts or SessionController.ts
window.skuilder = window.skuilder || {};
window.skuilder.pipeline = {
  lastRun: null,  // Timestamp
  sources: [],    // Per-source pipeline configs
  runs: [],       // Array of PipelineRunReport (last N runs)
  
  // Methods
  showLastRun(): void,           // Pretty-print last run
  showCard(cardId: string): void, // Show provenance for card
  showGeneratorBreakdown(): void, // Compare generator outputs
  showFilterImpact(): void,       // How each filter changed scores
};
```

**Pros:**
- Interactive exploration in console
- Query specific cards or time ranges
- Can export/copy data
- No UI rebuild needed
- Survives page interactions (unlike transient logs)

**Cons:**
- Memory overhead (need to cap history)
- Requires knowing the API exists
- Not discoverable via UI

### Option C: Enhanced SessionControllerDebug Component

**Approach:** Extend the existing debug panel to show pipeline provenance.

**Implementation:**
- Add "Pipeline" tab/section to SessionControllerDebug
- Show per-source breakdown: generator name, filter chain, card counts
- Expandable provenance for each queued card
- Show generator comparison (ELO scores vs SRS scores before mixing)

**Pros:**
- Visual, discoverable
- Already have activation mechanism (`window.debugMode`)
- Can update in real-time

**Cons:**
- Larger code change
- UI complexity
- Needs component rebuild to add features

### Option D: Pipeline Trace Mode (Hybrid)

**Approach:** Add a `PIPELINE_TRACE` mode that captures detailed per-card decisions.

**Implementation:**
- `window.PIPELINE_TRACE = true` enables capture
- Each `WeightedCard` gets an extended `traceLog: string[]` 
- At end of pipeline, expose full trace via `window.skuilder.pipelineTrace`
- Optionally, log summary to console

```typescript
interface PipelineTrace {
  runId: string;
  timestamp: Date;
  sources: Array<{
    courseId: string;
    courseName: string;
    generatorName: string;
    filters: string[];
    generatedCount: number;
    finalCount: number;
  }>;
  cards: Array<{
    cardId: string;
    courseId: string;
    origin: 'new' | 'review';
    initialScore: number;
    finalScore: number;
    provenance: StrategyContribution[];
    selected: boolean;
  }>;
  mixer: {
    algorithm: string;
    reviewsSelected: number;
    newSelected: number;
  };
}
```

**Pros:**
- Complete decision audit trail
- Can answer "why no reviews?" precisely
- Opt-in (no overhead in normal use)
- Exportable for bug reports

**Cons:**
- More implementation work
- Memory overhead when enabled

### Option E: Provenance-First Logging

**Approach:** Shift from count-based to decision-based logging.

**Implementation:**
Instead of:
```
[Pipeline] Execution: Composite Generator produced 50 → 1 filters → 20 results
```

Log:
```
[Pipeline] Course "Emily":
  ELO Generator: 50 new cards (top: 1.00, 0.99, 0.99)
  SRS Generator: 0 reviews (none due)
  Draft Priorities filter: 50 → 20 (top 3 boosted, 30 filtered below threshold)
[Pipeline] Course "Typing":
  ELO Generator: 3 new cards (top: 0.16, 0.08, 0.04)
  SRS Generator: 0 reviews (none due)
  ELO Distance filter: 3 → 3 (all passed)
[Mixer] Selected 23 cards: 20 from Emily (all new), 3 from Typing (all new)
```

**Pros:**
- Answers questions directly in logs
- Minimal runtime overhead
- Clear narrative

**Cons:**
- Still just logging (no interactivity)
- Requires careful log design

## Data Already Available

The system already tracks rich provenance in `WeightedCard.provenance[]`. The issue is **exposure**, not capture:

- Each card has full `StrategyContribution[]` trail
- Generator names, filter names, scores, reasons all present
- `reviewID` distinguishes reviews from new cards

The missing pieces:
1. **Generator-level aggregation** - what did each generator produce before CompositeGenerator merged?
2. **Filter impact summary** - how many cards boosted/penalized/passed?
3. **SRS "why no reviews"** - was `getPendingReviews()` empty, or were reviews scored low?

## Recommendation

**Combine Options B + E (Console Object + Provenance-First Logging)**

### Rationale:
1. **Option E (Provenance-First Logging)** gives immediate value with minimal changes - just reformatting existing log calls to tell the story
2. **Option B (Console Object)** provides interactive exploration when logs aren't enough

### Implementation Priority:
1. **Phase 1:** Improve log output (Option E) - 1-2 hours
   - Add generator-by-generator breakdown in CompositeGenerator
   - Log SRS query results before filtering (was the array empty?)
   - Summarize filter impact (boost/penalize/pass counts)

2. **Phase 2:** Add `window.skuilder.pipeline` API (Option B) - 2-4 hours
   - Capture last N pipeline runs
   - Methods: `showLastRun()`, `showCard(id)`, `explainReviews()`
   - JSON-exportable for bug reports

3. **Phase 3 (optional):** Enhance SessionControllerDebug - deferred until real need emerges

### Specifically for "Why No Reviews?"

Add explicit logging in SRSNavigator:
```typescript
const reviews = await this.user.getPendingReviews(courseId);
logger.info(`[SRS] Course ${courseId}: ${reviews.length} scheduled, ${dueReviews.length} due now`);
if (dueReviews.length === 0 && reviews.length > 0) {
  const nextDue = reviews.sort((a,b) => a.reviewTime - b.reviewTime)[0];
  logger.info(`[SRS] Next review due: ${nextDue.reviewTime} (in ${formatDuration(nextDue.reviewTime - now)})`);
}
```

This directly answers your question: "It also seems like scheduled reviews were at least queried."