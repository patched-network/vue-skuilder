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
## Phase 2: EloService (db) — COMPLETED ✅
- [x] p2.1 Add `updateUserAndCardEloPerTag()` method
- [x] p2.2 Wire to `adjustCourseScoresPerTag()`
- [x] p2.3 Ensure persistence of dynamically-created tags

**Files Modified:**
- `vue-skuilder/packages/db/src/study/services/EloService.ts`
