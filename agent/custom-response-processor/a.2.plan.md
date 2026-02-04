# Plan: Per-Tag ELO Scoring via `tagPerformance` Extension

**Selected Approach:** Option A — Extend `QuestionRecord` with `tagPerformance` field

Based on assessment feedback, we're implementing a framework-level feature that allows questions to report per-tag performance scores, enabling granular ELO adjustments.

---

## Design Overview

### Core Change

Add optional `tagPerformance?: Record<string, number>` to `QuestionRecord`. When present, the ELO update logic applies **per-tag scores** instead of a single score for all tags.

```typescript
interface QuestionRecord extends CardRecord, Evaluation {
  userAnswer: Answer;
  priorAttemps: number;
  tagPerformance?: Record<string, number>; // NEW: tag -> score [0,1]
}
```

### Behavioral Contract

| Scenario | Behavior |
|----------|----------|
| `tagPerformance` absent | Current behavior: all tags get same score |
| `tagPerformance` present | Each tag in the map gets its specific score |
| Tag in `tagPerformance` but not on card | **Create** tag ELO entry dynamically |
| Tag on card but not in `tagPerformance` | Use default score (from overall performance) |

---

## Files to Modify

### 1. `@vue-skuilder/common` — Data Model

**File:** `vue-skuilder/packages/common/src/db.ts`

**Change:** Add `tagPerformance` to `QuestionRecord` interface

```typescript
export interface QuestionRecord extends CardRecord, Evaluation {
  userAnswer: Answer;
  priorAttemps: number;
  tagPerformance?: Record<string, number>; // NEW
}
```

### 2. `@vue-skuilder/common` — ELO Calculation

**File:** `vue-skuilder/packages/common/src/elo.ts`

**Change:** Create new function `adjustCourseScoresPerTag()` that accepts per-tag scores

```typescript
/**
 * Like adjustCourseScores, but accepts per-tag performance map.
 * 
 * @param userElo - Current user ELO
 * @param cardElo - Current card ELO  
 * @param globalScore - Score for global ELO (0-1)
 * @param tagScores - Map of tag -> score. Missing tags use globalScore.
 * @returns Updated ELOs
 */
export function adjustCourseScoresPerTag(
  aElo: Eloish,
  bElo: Eloish,
  globalScore: number,
  tagScores: Map<string, number>
): { userElo: CourseElo; cardElo: CourseElo }
```

### 3. `@vue-skuilder/db` — EloService

**File:** `vue-skuilder/packages/db/src/study/services/EloService.ts`

**Change:** Add method `updateUserAndCardEloPerTag()` or extend existing method with optional `tagScores` parameter

```typescript
public async updateUserAndCardEloPerTag(
  globalScore: number,
  tagScores: Map<string, number>,
  course_id: string,
  card_id: string,
  userCourseRegDoc: CourseRegistrationDoc,
  currentCard: StudySessionRecord
): Promise<void>
```

### 4. `@vue-skuilder/db` — ResponseProcessor

**File:** `vue-skuilder/packages/db/src/study/services/ResponseProcessor.ts`

**Change:** In `processCorrectResponse()` and `processIncorrectResponse()`, check for `tagPerformance` and call appropriate EloService method

```typescript
private processCorrectResponse(...): ResponseResult {
  if (cardRecord.priorAttemps === 0) {
    const globalScore = 0.5 + (cardRecord.performance as number) / 2;
    
    if (cardRecord.tagPerformance) {
      // Per-tag scoring
      const tagScores = new Map(Object.entries(cardRecord.tagPerformance));
      void this.eloService.updateUserAndCardEloPerTag(
        globalScore, tagScores, courseId, cardId, ...
      );
    } else {
      // Existing single-score behavior
      void this.eloService.updateUserAndCardElo(globalScore, ...);
    }
    // ... rest unchanged
  }
}
```

### 5. LettersPractice Questions (Consumer Implementation)

**Files:**
- `commercial/letterspractice/src/questions/SpellingQuestionView.vue`
- `commercial/letterspractice/src/questions/WhoSaidThatView.vue`
- `commercial/letterspractice/src/questions/WordSelectionView.vue`

**Change:** Populate `tagPerformance` when submitting answers

Example for SpellingQuestion:
```typescript
function checkAnswer() {
  // ... existing evaluation logic ...
  
  // Compute per-GPC performance using phonetic analysis
  const tagPerformance = computeGpcPerformance(
    question.value.word,
    currentAnswer.value
  );
  
  // Submit with tag performance
  const record = questionUtils.submitAnswer(currentAnswer.value);
  record.tagPerformance = tagPerformance;
}

function computeGpcPerformance(
  expected: string, 
  actual: string
): Record<string, number> {
  // Use phoneticAnalytics library to:
  // 1. Segment expected word into GPCs
  // 2. Align actual answer
  // 3. Score each GPC position
  // Returns: { 'GPC-c-K': 0, 'GPC-a-AE': 1, 'GPC-t-T': 1 }
}
```

---

## Implementation Phases

### Phase 1: Framework Data Model
**Files:** `common/src/db.ts`
**Tasks:**
- [ ] p1.1 Add `tagPerformance?: Record<string, number>` to `QuestionRecord`
- [ ] p1.2 Export type for external consumption if needed

**Estimated scope:** ~5 lines changed

### Phase 2: ELO Calculation Logic  
**Files:** `common/src/elo.ts`
**Tasks:**
- [ ] p2.1 Create `adjustCourseScoresPerTag()` function
- [ ] p2.2 Handle dynamic tag creation (tag in map but not on cardElo)
- [ ] p2.3 Handle fallback for tags on card but not in map
- [ ] p2.4 Unit tests for new function

**Estimated scope:** ~60 lines new code

### Phase 3: EloService Integration
**Files:** `db/src/study/services/EloService.ts`
**Tasks:**
- [ ] p3.1 Add `updateUserAndCardEloPerTag()` method
- [ ] p3.2 Wire up to new `adjustCourseScoresPerTag()` function
- [ ] p3.3 Ensure dynamic tag creation persists correctly

**Estimated scope:** ~40 lines new code

### Phase 4: ResponseProcessor Integration
**Files:** `db/src/study/services/ResponseProcessor.ts`
**Tasks:**
- [ ] p4.1 Modify `processCorrectResponse()` to check for `tagPerformance`
- [ ] p4.2 Modify `processIncorrectResponse()` similarly
- [ ] p4.3 Ensure backward compatibility (absent field = old behavior)

**Estimated scope:** ~30 lines changed

### Phase 5: LettersPractice Integration (Separate PR)
**Files:** LP question views
**Tasks:**
- [ ] p5.1 Create `computeGpcPerformance()` utility using phonetic analytics
- [ ] p5.2 Integrate into SpellingQuestionView
- [ ] p5.3 Integrate into WhoSaidThatView
- [ ] p5.4 Integrate into WordSelectionView
- [ ] p5.5 Manual testing with real sessions

**Estimated scope:** ~100-150 lines new code

---

## Success Criteria

### Functional
1. Questions without `tagPerformance` behave exactly as before
2. Questions with `tagPerformance` apply per-tag scores
3. Tags referenced in `tagPerformance` but not on card are created dynamically
4. User ELO document correctly reflects per-tag updates
5. Card ELO document correctly reflects per-tag updates

### Technical
1. No runtime errors for existing question types
2. TypeScript compilation passes
3. Existing tests pass unchanged
4. New unit tests for `adjustCourseScoresPerTag()`

### Integration (LP-specific)
1. SpellingQuestion "cat" → "kat" grades c=0, a=1, t=1
2. WhoSaidThat correct answer bumps GPC tag up
3. WhoSaidThat incorrect answer grades both target and distractor appropriately

---

## Known Risks

| Risk | Mitigation |
|------|------------|
| Tag ID mismatch between question and card | LP must use consistent tag naming (GPC-x-Y format from catalogue) |
| Performance: many tags = many DB writes | Current architecture already writes per-tag; no regression |
| Card has no tags, only tagPerformance | Still works—tags created dynamically |
| tagPerformance scores outside [0,1] | Validation in adjustCourseScoresPerTag |

---

## Out of Scope

- Modifying how cards are initially tagged (separate concern)
- UI for viewing per-tag ELO (existing progress views work)
- Changes to SRS scheduling (only ELO affected)
- Option B hook mechanism (deferred unless needed)

---

## Dependencies

- Existing phonetic analytics library: `commercial/letterspractice/content/phoneticAnalytics/`
- GPC catalogue: `catalogue.ts` provides tag IDs like `GPC-c-K`, `GPC-th-TH`

---

## Next Steps

1. User approves plan
2. Create `a.3.todo.md` with checkbox items
3. Begin implementation in phase order