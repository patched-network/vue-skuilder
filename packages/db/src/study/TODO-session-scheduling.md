# Session Scheduling: Observed Deficiencies & Future Work

## Context

Observed during debugging of multi-course study sessions (Feb 2026). A 5-minute
session with 6 courses was scheduling ~101 cards (all available reviews) despite
only having time for ~20. Cards were globally sorted by score, causing
lower-scoring courses to be systematically unreached before session timeout.

Debuggers added: `window.skuilder.mixer`, `window.skuilder.session`.

## Completed

- **Mixer interleaving**: `QuotaRoundRobinMixer` now interleaves output by
  dealing from a randomly-shuffled source order instead of global score sort.
  This spreads courses throughout the queue so time-cutoff doesn't
  systematically exclude lower-scoring sources.

- **MixerDebugger**: Captures cross-source mixing decisions. Shows input
  batches, score distributions, selection rates, source balance analysis.

- **SessionDebugger**: Tracks runtime card presentation order, course
  interleaving patterns, clustering detection.

## Phase A: Right-Size Initial Load

**Problem**: `limit = 20` per source is hardcoded with no time-budget awareness.
For 6 sources that's up to 120 candidates for a 5-minute session.

**Approach**: Compute a realistic `targetCards` from session time and per-card
time estimates:

```
targetCards = sessionTimeSeconds / avgCardTimeSeconds
quotaPerSource = ceil(targetCards / numSources)
```

**Data available**: `CardRecord.timeSpent` (ms) exists on every historical
record. `CardHistory.records[]` has full per-card history. Could compute:
- Global user average (blunt but simple)
- Per-origin averages (reviews typically faster than new cards)
- Per-course averages (some courses have harder cards)

**Also**: `estimateReviewTime()` currently uses a flat `5 * reviewQ.length`.
Should use actual per-card time data, at minimum per-origin averages.

**Considerations**:
- Don't under-schedule — running out of cards mid-session is worse than
  over-scheduling slightly
- Historical data may not exist for new users; need a reasonable default
- New cards take longer than reviews; weight accordingly

## Phase B: Interleaving in _selectNextItemToHydrate

**Problem**: Even with interleaved mixer output, the queue split into
`reviewQ`/`newQ` can re-cluster by course if one course dominates reviews.
`_selectNextItemToHydrate` always takes `peek(0)` — course-blind.

**Approach**: After picking which queue, scan forward with small lookahead
to prefer a different course than the last presented card.

```
1. Pick queue (existing probability logic)
2. If peek(0).courseID === lastPresentedCourseID:
     Scan peek(1)..peek(LOOKAHEAD) for different course
3. If found: dequeue from that position
4. If not found within lookahead: take peek(0) anyway
```

**Requires**: `dequeueAt(index)` method on `ItemQueue` (currently only
dequeues from front).

**Trade-offs**:
- Lookahead window size (3-5 is probably right)
- Don't starve a dominant course forever — bounded lookahead handles this
- Interacts with hydration: the card at peek(3) may not be pre-hydrated.
  Hydration window is currently 2 per queue. May need to increase slightly
  or accept occasional hydration waits.

## Phase C: Rolling Refill (Mid-Session Recalibration)

**Problem**: All scheduling decisions are made at session start. No ability to
adapt to actual session pace, user performance, or course balance during the
session.

**Current state**: Queues loaded once in `prepareSession()`. Only mutation
during session is consumption + failure re-queuing. Hydration pre-caches 2 per
queue (6 total) — so the vast majority of queued items are just waiting.

**Approach**: Small initial load + async refill when queues run low.

```
1. Initial load: ~8-10 cards per source (enough for first few minutes)
2. Monitor queue depth after each card presentation
3. When queue drops below threshold (3-4 cards):
   → Trigger async refill from source(s)
   → Refill decisions factor in:
     - Actual pace (cards completed / time elapsed)
     - Course balance (which courses are underrepresented)
     - User performance (more failures = slower pace)
4. Refill populates queue; hydration service picks up new items naturally
```

**Key constraint**: Next card must always be pre-cached and ready without a DB
lookup. This is satisfied because refills happen at queue level (async,
background), and the hydration service already runs after each card.

**Architecture considerations**:
- `StudyContentSource.getWeightedCards()` would need to be callable
  mid-session (currently only called in `prepareSession`)
- Need to track which cards were already fetched to avoid duplicates
  (ItemQueue.seenCardIds partially handles this)
- Refill trigger should be non-blocking — fire and forget, let hydration
  service handle the rest
- Consider whether sources need a "cursor" or "offset" to avoid re-fetching
  the same top-N cards

## Related Observations

- **Score normalization**: Different courses/navigators produce scores on
  different effective ranges (e.g., 0.36-0.49 vs 0.70-0.98). The interleaving
  fix addresses the presentation problem, but a MinMaxNormalizingMixer or
  similar could address the selection problem for cases where quota-based
  selection isn't desired.

- **No user-level pace tracking**: The system has per-card `timeSpent` data but
  no aggregated user pace metric. A lightweight running average (e.g.,
  exponential moving average of last 20 cards) would be useful for both
  Phase A (initial load sizing) and Phase C (refill decisions).

- **`estimateCleanupTime` scope**: Currently only uses current-session records
  for failed cards. Could also use historical `CardHistory` for cards the user
  has seen before, giving better estimates for review failures.
