# Revised Assessment: Per-Tag ELO via Existing Evaluation System

## Key Insight

The system **already has hooks** for granular scoring—we just need to use them properly.

The `Evaluation` interface already supports nested/dimensional performance:

```typescript
// common/src/course-data.ts
interface Evaluation {
  isCorrect: boolean;
  performance: Performance;
}

type Performance =
  | number
  | {
      [dimension: string]: Performance;  // <-- RECURSIVE STRUCTURE
    };
```

And the `Question` class has **overridable methods**:

```typescript
// common-ui/src/composables/Displayable.ts
abstract class Question {
  protected abstract isCorrect(answer: Answer): boolean;           // MUST override
  protected displayedSkill(answer: Answer, timeSpent: number): number;  // CAN override
  public evaluate(answer: Answer, timeSpent: number): Evaluation;       // CAN override
}
```

---

## Lifecycle Trace: Answer → ELO Update

### 1. User submits answer in QuestionView

```typescript
// SpellingQuestionView.vue
questionUtils.submitAnswer(currentAnswer.value);
```

### 2. `useQuestionView` calls `question.evaluate()`

```typescript
// CompositionViewable.ts - submitAnswer()
const evaluation = question.value.evaluate(answer, viewableUtils.timeSpent.value);

const record: QuestionRecord = {
  ...evaluation,  // <-- Evaluation spread into record
  priorAttemps: priorAttempts.value,
  courseID: '',
  cardID: '',
  timeSpent: viewableUtils.timeSpent.value,
  timeStamp: viewableUtils.startTime.value,
  userAnswer: answer,
};

viewableUtils.emitResponse(record);
```

**Key observation:** `QuestionRecord` extends `Evaluation`, so whatever shape `performance` takes in the evaluation flows into the record.

### 3. `StudySession.processResponse()` receives the record

```typescript
// StudySession.vue
async processResponse(r: CardRecord) {
  // ... add cardID, courseID ...
  const result = await this.sessionController!.submitResponse(r, ...);
}
```

### 4. `ResponseProcessor.processResponse()` handles ELO

```typescript
// ResponseProcessor.ts
const userScore = 0.5 + (cardRecord.performance as number) / 2;
//                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                       BUG: Assumes performance is always a number!
```

---

## The Gap

The framework supports dimensional `Performance`, but `ResponseProcessor` **ignores it**:

```typescript
// Current code - only handles numeric performance
const userScore = 0.5 + (cardRecord.performance as number) / 2;
```

If a question returns structured performance like:

```typescript
{
  isCorrect: false,
  performance: {
    'GPC-c-K': 0,
    'GPC-a-AE': 1, 
    'GPC-t-T': 1,
    _global: 0.67,  // overall for SRS/global ELO
  }
}
```

...the current code casts it to `number` and breaks.

---

## Proposed Solution

### Option A-Revised: Leverage Existing Performance Structure

**No changes to `QuestionRecord`** — it already has what we need via `Evaluation.performance`.

**Changes needed:**

1. **Questions:** Override `evaluate()` to return dimensional performance with tag keys
2. **ResponseProcessor:** Parse structured performance and route to per-tag ELO updates
3. **Convention:** Define a semantic structure for tag-level scoring

### Proposed Performance Convention

```typescript
type TaggedPerformance = {
  _global: number;  // Overall score for global ELO and SRS
  [tagId: string]: number;  // Per-tag scores (0-1)
};

// Example from SpellingQuestion
{
  isCorrect: false,
  performance: {
    _global: 0.67,        // 2/3 correct
    'GPC-c-K': 0,         // wrong
    'GPC-a-AE': 1,        // right
    'GPC-t-T': 1,         // right
  }
}
```

### ResponseProcessor Changes

```typescript
private processCorrectResponse(...): ResponseResult {
  if (cardRecord.priorAttemps === 0) {
    let globalScore: number;
    let tagScores: Map<string, number> | null = null;

    if (typeof cardRecord.performance === 'number') {
      // Simple numeric performance (existing behavior)
      globalScore = 0.5 + cardRecord.performance / 2;
    } else {
      // Structured performance with tag-level scores
      const perf = cardRecord.performance as Record<string, number>;
      globalScore = 0.5 + (perf._global ?? 0.5) / 2;
      
      // Extract tag scores (everything except _global)
      tagScores = new Map();
      for (const [key, value] of Object.entries(perf)) {
        if (key !== '_global' && typeof value === 'number') {
          tagScores.set(key, value);
        }
      }
    }

    if (tagScores && tagScores.size > 0) {
      void this.eloService.updateUserAndCardEloPerTag(
        globalScore, tagScores, courseId, cardId, ...
      );
    } else {
      void this.eloService.updateUserAndCardElo(globalScore, ...);
    }
  }
}
```

---

## Comparison: Original Option A vs A-Revised

| Aspect | Original Option A | A-Revised |
|--------|-------------------|-----------|
| Data model change | Add `tagPerformance` to `QuestionRecord` | None — use existing `performance` |
| Type safety | New optional field | Leverage existing `Performance` union |
| Question implementation | Set `record.tagPerformance` after submit | Override `evaluate()` to return structured |
| Backward compat | Check for optional field | Check `typeof performance` |
| Semantic clarity | Separate field for tags | Unified in `performance` |

**A-Revised is cleaner** because:
- No schema changes to `QuestionRecord`
- Uses existing extensibility (`Performance` is already a union type)
- Questions control their own evaluation (proper OO)
- `evaluate()` override is the intended extension point

---

## Addressing Your Observations

### "Protected methods are default implementations which may be overridden"

**Correct.** In TypeScript/JavaScript:
- `protected abstract` = subclass MUST implement
- `protected` (non-abstract) = subclass MAY override, default provided

So `Question.evaluate()` can be overridden by `SpellingQuestion` to return richer performance data.

### "The system already has hooks for what we want"

**Yes.** The hooks are:
1. `Question.evaluate()` — questions return structured evaluation
2. `Performance` type — already supports nested dimensions
3. `ResponseProcessor` — needs modification to consume structured performance

### "Questions could attach functional evaluationHandlers"

This is an interesting advanced pattern but likely overkill for now. The simpler approach:
- Questions return structured `performance` 
- `ResponseProcessor` interprets known conventions (`_global`, tag keys)

---

## Files to Modify

### Framework (vue-skuilder)

| File | Change |
|------|--------|
| `common/src/course-data.ts` | Document `_global` convention in comments |
| `common/src/elo.ts` | Add `adjustCourseScoresPerTag()` |
| `db/src/study/services/EloService.ts` | Add `updateUserAndCardEloPerTag()` |
| `db/src/study/services/ResponseProcessor.ts` | Parse structured performance, route to per-tag ELO |

### LettersPractice (commercial)

| File | Change |
|------|--------|
| `questions/SpellingQuestion.ts` | Override `evaluate()` to return per-GPC scores |
| `questions/WhoSaidThat.ts` | Override `evaluate()` similarly |
| `questions/WordSelection.ts` | Override `evaluate()` similarly |

---

## Implementation Phases

### Phase 1: Framework — ELO Calculation
- [ ] p1.1 Add `adjustCourseScoresPerTag()` to `elo.ts`
- [ ] p1.2 Add `updateUserAndCardEloPerTag()` to `EloService`
- [ ] p1.3 Document `_global` and tag-key conventions

### Phase 2: Framework — ResponseProcessor
- [ ] p2.1 Detect structured vs numeric `performance`
- [ ] p2.2 Extract `_global` and tag scores
- [ ] p2.3 Route to appropriate EloService method
- [ ] p2.4 Handle both correct and incorrect paths

### Phase 3: LP Questions
- [ ] p3.1 Override `evaluate()` in `SpellingQuestion`
- [ ] p3.2 Override `evaluate()` in `WhoSaidThat`
- [ ] p3.3 Override `evaluate()` in `WordSelection`
- [ ] p3.4 Use phonetic analytics to compute per-GPC scores

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing questions | Check `typeof performance === 'number'` first |
| Tag IDs must match card tags | Use consistent GPC ID format from catalogue |
| Deeply nested Performance | Only support single-level tag object for now |

---

## Recommendation

**Proceed with A-Revised.** It's cleaner than original Option A because:
1. Zero changes to `QuestionRecord` interface
2. Uses the existing `Performance` union type as intended
3. `Question.evaluate()` is the proper extension point
4. Better separation of concerns (questions own their evaluation)

If user approves, I'll create a detailed `a.4.plan-revised.md` with implementation specifics.