# Todo: Pipeline Debug Visibility Implementation

## Overview

Implementing Options B + E from assessment:
- **Option E**: Provenance-first narrative logging
- **Option B**: `window.skuilder.pipeline` console API

---

## Phase 1: Provenance-First Logging (Option E) ✅ COMPLETED

### p1.1 SRS Generator Transparency ✅
- [x] Add info-level log showing scheduled vs due review counts
- [x] Log next review due time when 0 are currently due
- File: `packages/db/src/core/navigators/generators/srs.ts`

### p1.2 ELO Generator Summary ✅
- [x] Add info-level log showing new card count and top scores
- File: `packages/db/src/core/navigators/generators/elo.ts`

### p1.3 CompositeGenerator Breakdown ✅
- [x] Log per-generator contribution before aggregation
- [x] Show which generators produced cards (ELO vs SRS counts)
- File: `packages/db/src/core/navigators/generators/CompositeGenerator.ts`

### p1.4 Filter Impact Summary ✅
- [x] Log boost/penalize/pass counts per filter
- File: `packages/db/src/core/navigators/Pipeline.ts`

### p1.5 Pipeline Hint ✅
- [x] Add hint about `window.skuilder.pipeline` in execution summary log
- File: `packages/db/src/core/navigators/Pipeline.ts`

---

## Phase 2: Console Debug API (Option B) ✅ COMPLETED

### p2.1 Create PipelineDebugger Module ✅
- [x] Create `packages/db/src/core/navigators/PipelineDebugger.ts`
- [x] Define `PipelineRunReport` interface
- [x] Implement capture ring buffer (last N runs)
- [x] Implement `showLastRun()` method
- [x] Implement `showCard(cardId)` method  
- [x] Implement `explainReviews()` method
- [x] Export as JSON for bug reports

### p2.2 Integrate with Pipeline ✅
- [x] Call `captureRun()` at end of `getWeightedCards()`
- [x] Track generator summaries for CompositeGenerator
- [x] Track filter impacts with removed count
- File: `packages/db/src/core/navigators/Pipeline.ts`

### p2.3 Expose on Window ✅
- [x] Mount `window.skuilder.pipeline` (auto-mounts on module load)
- [x] Works in both dev and prod builds
- File: `packages/db/src/core/navigators/PipelineDebugger.ts`

### p2.4 Export from Package ✅
- [x] Add to `packages/db/src/core/navigators/index.ts` exports

---

## Status

- Phase 1: ✅ COMPLETED
- Phase 2: ✅ COMPLETED

---

## Build Verification

- [x] `yarn workspace @vue-skuilder/db build` succeeds
- [x] No TypeScript errors or warnings in modified files

---

## New Log Output Examples

After these changes, logs will show:

```
[SRS] Course abc123: 0 reviews due now (5 scheduled, next in 2h)
[ELO] Course abc123: 50 new cards (top scores: 1.00, 0.99, 0.99)
[Composite] Generator breakdown: ELO (default): 50 new (top: 1.00) | SRS (default): 0 cards
[Pipeline] Execution: Composite Generator produced 50 → 1 filters → 20 results (top scores: 1.00, 0.99, 0.99)
  Filter impact: Draft Priorities: +15/-5/=30
  💡 Inspect: window.skuilder.pipeline
```

## Console API Usage

```javascript
// In browser console:
window.skuilder.pipeline.showLastRun()     // Summary of last run
window.skuilder.pipeline.showCard('abc')   // Provenance for specific card
window.skuilder.pipeline.explainReviews()  // Why reviews were/weren't selected
window.skuilder.pipeline.listRuns()        // Table of recent runs
window.skuilder.pipeline.export()          // JSON for bug reports
window.skuilder.pipeline.help()            // Show all commands
```
