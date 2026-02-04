# Alternative Plan: Option A + B (tagPerformance + Hooks)

**Why This Document Exists:** User requested a separate plan if I advocate for hooks. I do have some concerns about pure Option A that merit consideration, though I respect the preference for simplicity.

---

## Rationale for Including Hooks (Option B)

### Concern 1: Coupling Question Logic to Card Tags

With pure Option A, the question view must know the exact tag IDs that will exist on cards. This creates tight coupling:

```typescript
// SpellingQuestionView must generate exact tag IDs
record.tagPerformance = {
  'GPC-c-K': 0,   // What if card uses 'gpc-c-k' or 'consonant-c'?
  'GPC-a-AE': 1,
  'GPC-t-T': 1,
};
```

If card tagging conventions change, all question views must update.

**With hooks:** Question reports what it knows (character positions, phonemes), and a course-specific hook translates to tag IDs:

```typescript
// Question reports semantically
record.gpcResults = [
  { position: 0, grapheme: 'c', phoneme: 'K', correct: false },
  { position: 1, grapheme: 'a', phoneme: 'AE', correct: true },
  { position: 2, grapheme: 't', phoneme: 'T', correct: true },
];

// Hook translates to tags
hook.computeTagScores(record) → Map {
  'GPC-c-K' → 0,
  'GPC-a-AE' → 1,
  'GPC-t-T' → 1,
}
```

### Concern 2: Different Grading Strategies Per Question Type

The three LP question types have different grading semantics:

| Type | Correct | Incorrect |
|------|---------|-----------|
| Spelling | Each GPC position graded | Each GPC position graded |
| WhoSaidThat | Target GPC up | Target down, distractor down (scaled by distance) |
| FindTheWord | All GPCs up | All GPCs down? Or just distinguishing GPCs? |

Pure Option A can handle this, but the grading logic must live in each question view. With hooks, grading strategies could be centralized:

```typescript
// Centralized in LP
const lpGradingHook = {
  getTagScores(record, defaultScore) {
    if (record.questionType === 'WhoSaidThat') {
      return gradeWhoSaidThat(record);
    }
    // etc.
  }
};
```

### Concern 3: Future Extensibility

What if we later want:
- Weighted tag scoring (some tags matter more)
- Conditional scoring (don't grade tags user hasn't been introduced to)
- A/B testing different grading strategies

Hooks provide the extension point; pure Option A requires framework changes for each.

---

## Why I'm Not Pushing Hard for B

1. **YAGNI**: We don't currently need the flexibility hooks provide
2. **Simplicity**: Option A is self-contained and understandable
3. **Your preference**: You've indicated Option A should suffice
4. **Iteration**: If we hit walls, we can add hooks later

---

## Hybrid Implementation (If We Went This Route)

### Additional Files Beyond Option A

**File:** `db/src/study/services/ResponseProcessor.ts`

```typescript
export interface EloScoreProvider {
  /**
   * Given a card record, compute per-tag scores.
   * Return null to fall back to tagPerformance field or default behavior.
   */
  getTagScores(
    record: QuestionRecord,
    defaultScore: number,
    cardTags: string[]
  ): Map<string, number> | null;
}

export class ResponseProcessor {
  private eloScoreProvider?: EloScoreProvider;

  setEloScoreProvider(provider: EloScoreProvider): void {
    this.eloScoreProvider = provider;
  }

  private resolveTagScores(
    record: QuestionRecord,
    defaultScore: number,
    cardTags: string[]
  ): Map<string, number> | null {
    // Priority 1: Custom provider
    if (this.eloScoreProvider) {
      const custom = this.eloScoreProvider.getTagScores(record, defaultScore, cardTags);
      if (custom) return custom;
    }
    
    // Priority 2: tagPerformance on record
    if (record.tagPerformance) {
      return new Map(Object.entries(record.tagPerformance));
    }
    
    // Fallback: null signals "use default single-score behavior"
    return null;
  }
}
```

**File:** `db/src/study/SessionController.ts`

```typescript
interface SessionControllerConfig {
  eloScoreProvider?: EloScoreProvider;
}

constructor(
  sources: StudyContentSource[],
  time: number,
  dataLayer: DataLayerProvider,
  getViewComponent: (viewId: string) => TView,
  mixer?: SourceMixer,
  config?: SessionControllerConfig  // NEW
) {
  // ...existing setup...
  
  if (config?.eloScoreProvider) {
    this.services.response.setEloScoreProvider(config.eloScoreProvider);
  }
}
```

**File:** `common-ui/src/components/StudySession.vue` (props)

```typescript
props: {
  // ...existing props...
  
  sessionHooks: {
    type: Object as PropType<{
      eloScoreProvider?: EloScoreProvider;
    }>,
    default: undefined,
  },
}
```

### LP Usage

```typescript
// In LP's StudyView.vue
const lpEloProvider: EloScoreProvider = {
  getTagScores(record, defaultScore, cardTags) {
    // LP-specific grading logic
    if ('gpcResults' in record) {
      return gradeGpcResults(record.gpcResults);
    }
    return null; // Fall back to tagPerformance
  }
};

<StudySession
  :session-hooks="{ eloScoreProvider: lpEloProvider }"
  ...
/>
```

---

## Additional Phases (On Top of Option A Plan)

### Phase B1: Hook Interface
**Files:** `ResponseProcessor.ts`
- [ ] pB1.1 Define `EloScoreProvider` interface
- [ ] pB1.2 Add `setEloScoreProvider()` method
- [ ] pB1.3 Create `resolveTagScores()` helper

### Phase B2: Threading Through Components
**Files:** `SessionController.ts`, `StudySession.vue`
- [ ] pB2.1 Add config parameter to SessionController
- [ ] pB2.2 Add sessionHooks prop to StudySession
- [ ] pB2.3 Wire up on session construction

### Phase B3: LP Hook Implementation
**Files:** LP services/hooks directory
- [ ] pB3.1 Create `lpEloProvider` with grading strategies
- [ ] pB3.2 Integrate into StudyView

---

## Recommendation

**Start with Option A only.** 

If during Phase 5 (LP integration) we find that:
- Tag ID coupling is problematic
- Different question types need centralized grading logic
- We're duplicating strategy code across views

...then we revisit and add hooks. The Option A foundation doesn't preclude adding B later.

---

## Decision Record

| Date | Decision |
|------|----------|
| (today) | User selected Option A only, deferring B |
| | This document preserved for future reference if hooks become needed |