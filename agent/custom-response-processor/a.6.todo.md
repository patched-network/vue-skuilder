# TODO: Per-Tag ELO Scoring Implementation

## Phase 1: ELO Infrastructure (common) — COMPLETED ✅

- [x] p1.1 Add `adjustCourseScoresPerTag()` to `elo.ts`
  - Handle tag iteration with individual scores
  - Initialize missing tags on user/card ELO
  - Apply global score to global ELO
- [x] p1.2 Update `Performance` type in `course-data.ts`
  - Added `TaggedPerformance` interface with required `_global`
  - Added `isTaggedPerformance()` type guard
  - Flattened structure (no recursive nesting)
