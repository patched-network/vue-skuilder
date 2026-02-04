# Plan: Per-Tag ELO via Existing Performance Structure (A-Revised)

**Selected Approach:** Leverage existing `Evaluation.performance` union type for tag-level scoring

---

## Design Summary

Questions override `evaluate()` to return structured performance with tag keys. ResponseProcessor detects this structure and applies per-tag ELO updates.

### Performance Convention

```typescript
// Numeric (existing, backward-compatible)
performance: 0.85

// Structured (new, per-tag scoring)
performance: {
  _global: 0.67,      // Required: overall score for SRS and global ELO
  'GPC-c-K': 0,       // Tag-specific scores
  'GPC-a-AE': 1,
  'GPC-t-T': 1,
}
```

**Rules:**
- `_global` is required when using structured performance
- Tag keys should match card/user ELO tag IDs (e.g., `GPC-c-K` from catalogue)
- Scores are [0, 1] range
- Tags not on card are created dynamically

---

## Files to Modify

### Phase 1: ELO Calculation Infrastructure

#### 1.1 `vue-skuilder/packages/common/src/elo.ts`

**Add:** `adjustCourseScoresPerTag()` function

```typescript
/**
 * Adjusts ELO scores with per-tag granularity.
 * 
 * @param aElo - User's current ELO
 * @param bElo - Card's current ELO
 * @param globalScore - Score for global ELO [0,1]
 * @param tagScores - Map of tag ID -> score [0,1]
 * @returns Updated ELOs
 */
export function adjustCourseScoresPerTag(
  aElo: Eloish,
  bElo: Eloish,
  globalScore: number,
  tagScores: Map<string, number>
): { userElo: CourseElo; cardElo: CourseElo }
```

**Implementation notes:**
- Iterate `tagScores` entries
- For each tag, check if exists on user/card ELO; if not, initialize
- Apply individual score to each tag
- Apply `globalScore` to global ELO
- Return updated structures

#### 1.2 `vue-skuilder/packages/common/src/course-data.ts`

**Add:** Documentation comment for `_global` convention

```typescript
type Performance =
  | number
  | {
      /**
       * When performance is structured, `_global` provides the overall score
       * for SRS scheduling and global ELO updates.
       * 
       * Other keys are treated as tag IDs for per-tag ELO updates.
       * Example: { _global: 0.67, 'GPC-c-K': 0, 'GPC-a-AE': 1 }
       */
      [dimension: string]: Performance;
    };
```

---

### Phase 2: EloService Integration

#### 2.1 `vue-skuilder/packages/db/src/study/services/EloService.ts`

**Add:** `updateUserAndCardEloPerTag()` method

```typescript
/**
 * Updates ELO with per-tag granularity.
 * Tags in tagScores but not on card will be created.
 */
public async updateUserAndCardEloPerTag(
  globalScore: number,
  tagScores: Map<string, number>,
  course_id: string,
  card_id: string,
  userCourseRegDoc: CourseRegistrationDoc,
  currentCard: StudySessionRecord
): Promise<void>
```

**Implementation:**
- Fetch user and card ELO (existing pattern)
- Call `adjustCourseScoresPerTag()` from common
- Persist both updates

---

### Phase 3: ResponseProcessor Integration

#### 3.1 `vue-skuilder/packages/db/src/study/services/ResponseProcessor.ts`

**Modify:** `processCorrectResponse()` and `processIncorrectResponse()`

**Add helper:**

```typescript
/**
 * Extracts global score and per-tag scores from performance.
 */
private parsePerformance(performance: Performance): {
  globalScore: number;
  tagScores: Map<string, number> | null;
} {
  if (typeof performance === 'number') {
    return { globalScore: performance, tagScores: null };
  }

  // Structured performance
  const perf = performance as Record<string, number>;
  const globalScore = perf._global ?? 0.5;
  
  const tagScores = new Map<string, number>();
  for (const [key, value] of Object.entries(perf)) {
    if (key !== '_global' && typeof value === 'number') {
      tagScores.set(key, value);
    }
  }
  
  return {
    globalScore,
    tagScores: tagScores.size > 0 ? tagScores : null,
  };
}
```

**Modify `processCorrectResponse()`:**

```typescript
if (cardRecord.priorAttemps === 0) {
  void this.srsService.scheduleReview(history, studySessionItem);

  const { globalScore, tagScores } = this.parsePerformance(cardRecord.performance);
  const userScore = 0.5 + globalScore / 2;

  if (tagScores) {
    // Per-tag ELO update
    const tagUserScores = new Map<string, number>();
    for (const [tag, score] of tagScores) {
      tagUserScores.set(tag, 0.5 + score / 2);
    }
    void this.eloService.updateUserAndCardEloPerTag(
      userScore, tagUserScores, courseId, cardId, courseRegistrationDoc, currentCard
    );
  } else {
    // Existing single-score behavior
    void this.eloService.updateUserAndCardElo(
      userScore, courseId, cardId, courseRegistrationDoc, currentCard
    );
  }
}
```

**Similar changes to `processIncorrectResponse()`**

---

### Phase 4: LettersPractice Question Integration

#### 4.1 `commercial/letterspractice/src/questions/SpellingQuestion.ts`

**Override:** `evaluate()` method

```typescript
public evaluate(answer: Answer, timeSpent: number): Evaluation {
  const isCorrect = this.isCorrect(answer);
  const answerStr = String(answer).toLowerCase();
  
  // Compute per-GPC performance using phonetic analytics
  const gpcResults = this.computeGpcPerformance(answerStr);
  
  // Build structured performance
  const performance: Record<string, number> = {
    _global: gpcResults.overallScore,
  };
  
  for (const [gpcId, score] of gpcResults.perGpc) {
    performance[gpcId] = score;
  }
  
  return { isCorrect, performance };
}

private computeGpcPerformance(answer: string): {
  overallScore: number;
  perGpc: Map<string, number>;
} {
  // Use phonetic analytics to:
  // 1. Segment expected word into GPCs
  // 2. Align answer characters
  // 3. Score each GPC
  // ...implementation using catalogue.ts
}
```

#### 4.2 `commercial/letterspractice/src/questions/WhoSaidThat.ts`

**Override:** `evaluate()` method

```typescript
public evaluate(answer: Answer, timeSpent: number): Evaluation {
  const isCorrect = this.isCorrect(answer);
  const targetGpc = this.targetGpcId;  // e.g., 'GPC-sh-SH'
  
  const performance: Record<string, number> = {
    _global: isCorrect ? 1 : 0,
    [targetGpc]: isCorrect ? 1 : 0,
  };
  
  // If incorrect, also penalize the distractor they selected
  if (!isCorrect && this.selectedDistractor) {
    performance[this.selectedDistractor.gpcId] = 0;
  }
  
  return { isCorrect, performance };
}
```

#### 4.3 `commercial/letterspractice/src/questions/WordSelection.ts`

**Override:** `evaluate()` similarly, scoring GPCs in the target word.

---

## Implementation Task List

### Phase 1: ELO Infrastructure (common)

- [ ] p1.1 Add `adjustCourseScoresPerTag()` to `elo.ts`
  - Handle tag iteration with individual scores
  - Initialize missing tags on user/card ELO
  - Apply global score to global ELO
- [ ] p1.2 Add unit tests for `adjustCourseScoresPerTag()`
  - Test: all tags present
  - Test: some tags missing (dynamic creation)
  - Test: empty tagScores map (fallback to global-only)
- [ ] p1.3 Document `_global` convention in `course-data.ts`

### Phase 2: EloService (db)

- [ ] p2.1 Add `updateUserAndCardEloPerTag()` method
- [ ] p2.2 Wire to `adjustCourseScoresPerTag()`
- [ ] p2.3 Ensure persistence of dynamically-created tags

### Phase 3: ResponseProcessor (db)

- [ ] p3.1 Add `parsePerformance()` helper method
- [ ] p3.2 Modify `processCorrectResponse()` to use helper
- [ ] p3.3 Modify `processIncorrectResponse()` to use helper
- [ ] p3.4 Ensure backward compatibility (numeric performance unchanged)

### Phase 4: LP Questions (commercial)

- [ ] p4.1 Create GPC scoring utility using phonetic analytics
- [ ] p4.2 Override `evaluate()` in `SpellingQuestion`
- [ ] p4.3 Override `evaluate()` in `WhoSaidThat`
- [ ] p4.4 Override `evaluate()` in `WordSelection`
- [ ] p4.5 Manual testing with real study sessions

---

## Success Criteria

### Functional

1. Questions returning `performance: number` work unchanged
2. Questions returning structured performance get per-tag ELO updates
3. Tags not on card are created dynamically in ELO docs
4. `_global` score used for SRS and global ELO
5. LP SpellingQuestion: "cat" → "kat" grades `GPC-c-K=0`, `GPC-a-AE=1`, `GPC-t-T=1`

### Technical

1. TypeScript compiles without errors
2. Existing tests pass
3. New unit tests for `adjustCourseScoresPerTag()` pass
4. No runtime errors for existing question types

---

## Risks

| Risk | Mitigation |
|------|------------|
| Deeply nested Performance | Only support single-level tag object; ignore nested |
| Tag ID format mismatch | Use GPC catalogue IDs consistently |
| Performance without `_global` | Default to 0.5 (neutral) |
| Many tags = slow DB writes | Already per-tag; no regression |

---

## Out of Scope

- Changes to `QuestionRecord` interface
- Hook/callback injection mechanism
- UI for viewing per-tag progress
- Changes to SRS scheduling logic

---

## Testing Strategy

### Unit Tests (new)

1. `adjustCourseScoresPerTag()`:
   - Numeric input fallback
   - All tags present on card
   - Tags only in map (dynamic creation)
   - Mixed: some tags on card, some new
   - Edge: empty tagScores

2. `parsePerformance()`:
   - Numeric performance → null tagScores
   - Structured with `_global` and tags
   - Structured missing `_global` → default 0.5

### Integration Tests (manual)

1. Existing question type → unchanged behavior
2. LP SpellingQuestion → per-GPC ELO changes visible
3. Session with multiple question types → all work

---

## Next Steps

1. User approves this plan
2. Create `a.5.todo.md` with checkboxes
3. Begin Phase 1 implementation