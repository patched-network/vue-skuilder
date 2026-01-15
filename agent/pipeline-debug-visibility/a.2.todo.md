# Todo: Pipeline Debug Visibility Implementation

## Overview

Implementing Options B + E from assessment:
- **Option E**: Provenance-first narrative logging
- **Option B**: `window.skuilder.pipeline` console API

---

## Phase 1: Provenance-First Logging (Option E)

### p1.1 SRS Generator Transparency
- [ ] Add info-level log showing scheduled vs due review counts
- [ ] Log next review due time when 0 are currently due
- File: `packages/db/src/core/navigators/generators/srs.ts`

### p1.2 ELO Generator Summary  
- [ ] Add info-level log showing new card count and top scores
- File: `packages/db/src/core/navigators/generators/elo.ts`

### p1.3 CompositeGenerator Breakdown
- [ ] Log per-generator contribution before aggregation
- [ ] Show which generators produced cards (ELO vs SRS counts)
- File: `packages/db/src/core/navigators/generators/CompositeGenerator.ts`

### p1.4 Filter Impact Summary
- [ ] Log boost/penalize/pass counts per filter
- File: `packages/db/src/core/navigators/Pipeline.ts`

### p1.5 Pipeline Hint
- [ ] Add hint about `window.skuilder.pipeline` in execution summary log
- File: `packages/db/src/core/navigators/Pipeline.ts`

---

## Phase 2: Console Debug API (Option B)

### p2.1 Create PipelineDebugger Module
- [ ] Create `packages/db/src/core/navigators/PipelineDebugger.ts`
- [ ] Define `PipelineRunReport` interface
- [ ] Implement capture ring buffer (last N runs)
- [ ] Implement `showLastRun()` method
- [ ] Implement `showCard(cardId)` method  
- [ ] Implement `explainReviews()` method
- [ ] Export as JSON for bug reports

### p2.2 Integrate with Pipeline
- [ ] Call PipelineDebugger.capture() at end of getWeightedCards()
- File: `packages/db/src/core/navigators/Pipeline.ts`

### p2.3 Expose on Window
- [ ] Mount `window.skuilder.pipeline` 
- [ ] Ensure works in both dev and prod builds
- File: `packages/db/src/core/navigators/Pipeline.ts` or new init file

### p2.4 Export from Package
- [ ] Add to `packages/db/src/index.ts` exports if needed

---

## Status

- Phase 1: NOT STARTED
- Phase 2: NOT STARTED

---

## Notes

- Logs should use `logger.info()` not `logger.debug()` for visibility in prod
- Console API should be available even when logs are suppressed
- Keep memory footprint reasonable (cap run history at ~10 runs)