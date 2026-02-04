# Assessment: Custom ResponseProcessor Logic for Per-GPC ELO Updates

## Problem Statement

LettersPractice's SpellingQuestion exercises multiple grapheme-phoneme correspondences (GPCs) per question. For example, "Spell 'cat'" involves 3 GPCs: `c=/k/`, `a=/æ/`, `t=/t/`.

When a learner types "kat":
- `c` → **incorrect** (typed 'k' instead of 'c')
- `a` → **correct**
- `t` → **correct**

**Current behavior**: All tags on the card move up or down together based on the overall `isCorrect` flag.

**Desired behavior**: Per-GPC scoring—correct GPCs receive positive ELO adjustment, incorrect GPCs receive negative adjustment.

---

## Current Architecture

### Flow Summary

```
StudyView.vue (LettersPractice)
    └─→ <StudySession> (common-ui)
           └─→ SessionController (db package)
                  └─→ ResponseProcessor.processResponse()
                         ├─→ SrsService.scheduleReview()
                         └─→ EloService.updateUserAndCardElo()
```

### Key Components

| Component | Location | Role |
|-----------|----------|------|
| `StudyView.vue` | `commercial/letterspractice/src/views/` | LP's study page, renders StudySession |
| `StudySession.vue` | `common-ui/src/components/` | Framework study component, creates SessionController |
| `SessionController` | `db/src/study/` | Orchestrates session, owns services |
| `ResponseProcessor` | `db/src/study/services/` | Processes responses, triggers ELO/SRS updates |
| `EloService` | `db/src/study/services/` | Calls `adjustCourseScores()` |
| `adjustCourseScores()` | `common/src/elo.ts` | ELO calculation—applies SAME userScore to ALL tags |

### Current ELO Update Flow

```typescript
// In ResponseProcessor.processCorrectResponse():
const userScore = 0.5 + (cardRecord.performance as number) / 2;
void this.eloService.updateUserAndCardElo(userScore, ...);

// In EloService.updateUserAndCardElo():
const eloUpdate = adjustCourseScores(userElo, cardElo, userScore);
// ^ This applies same score to global AND all tags

// In elo.ts adjustCourseScores():
Object.keys(cardElo.tags).forEach((k) => {
  // Each tag gets the SAME userScore
  const adjusted = adjustScores(userTagElo, cardElo.tags[k], userScore);
  userElo.tags[k] = adjusted.userElo;
  cardElo.tags[k] = adjusted.cardElo;
});
```

---

## Options

### Option A: Extend QuestionRecord with Per-Tag Performance

Add optional `tagPerformance?: Record<string, number>` to `QuestionRecord`.

```typescript
interface QuestionRecord extends CardRecord, Evaluation {
  userAnswer: Answer;
  priorAttemps: number;
  tagPerformance?: Record<string, number>; // NEW: tag -> score [0,1]
}
```

ResponseProcessor would check for this field and use per-tag scores if present.

**Pros:**
- Clean, self-documenting data model
- Framework-level solution—other courses could use it
- Type-safe

**Cons:**
- Modifies shared `@vue-skuilder/common` package
- All consumers see this optional field (minor pollution)
- Requires ResponseProcessor changes to consume it

### Option B: ResponseProcessor Hook/Callback Pattern

Add injection point for custom ELO logic:

```typescript
interface ResponseProcessorHook {
  computeTagScores?(
    cardRecord: CardRecord,
    cardElo: CourseElo,
    defaultScore: number
  ): Map<string, number> | null; // null = use default behavior
}

// SessionController accepts optional hook
constructor(..., hooks?: { responseProcessor?: ResponseProcessorHook })
```

**Pros:**
- Non-breaking—existing code unchanged
- App-specific customization cleanly isolated
- Flexible for various use cases

**Cons:**
- More complex API surface
- Need to thread hooks through: `StudySession` props → `SessionController` → `ResponseProcessor`
- Hook interface design requires care

### Option C: Injectable ResponseProcessor (Replacement)

Allow passing a custom `ResponseProcessor` implementation to `SessionController`:

```typescript
constructor(
  ...,
  customResponseProcessor?: ResponseProcessor
)
```

**Pros:**
- Full control for apps
- No framework interface changes

**Cons:**
- Duplicates logic—LP would copy/paste most of ResponseProcessor
- Maintenance burden when framework evolves
- Breaks encapsulation

### Option D: Extended Answer Format (Question-Driven)

SpellingQuestion embeds per-GPC evaluation in the answer/record itself:

```typescript
// In SpellingQuestionView, extend the record:
const record = questionUtils.submitAnswer(currentAnswer.value);
(record as any).gpcPerformance = {
  'c': 0,    // wrong
  'a': 1,    // right
  't': 1,    // right
};
```

ResponseProcessor looks for this data and uses it if present.

**Pros:**
- Question knows best how to evaluate itself granularly
- Data flows naturally with the record
- Minimal interface changes

**Cons:**
- Type safety issues (casting to `any`)
- Still need ResponseProcessor to know how to consume custom field
- Implicit contract between question and processor

---

## Hybrid Recommendation: Option A + B

**Combine structured data extension with hook-based consumption:**

1. **Extend `QuestionRecord`** (Option A) with optional `tagPerformance` field
2. **Add hook point** (Option B) in `ResponseProcessor` for custom ELO handling
3. **LP's SpellingQuestion** computes per-GPC performance and populates `tagPerformance`
4. **LP injects a hook** that reads `tagPerformance` and returns per-tag scores

This provides:
- ✅ Type-safe data model
- ✅ Clean injection point
- ✅ Other apps unaffected
- ✅ Framework-level extensibility
- ✅ LP gets full control

### Implementation Sketch

```typescript
// common/src/db.ts
interface QuestionRecord extends CardRecord, Evaluation {
  userAnswer: Answer;
  priorAttemps: number;
  tagPerformance?: Record<string, number>; // NEW
}

// db/src/study/services/ResponseProcessor.ts
interface EloScoreProvider {
  getTagScores(record: CardRecord, defaultScore: number): Map<string, number> | null;
}

class ResponseProcessor {
  private eloScoreProvider?: EloScoreProvider;

  setEloScoreProvider(provider: EloScoreProvider) {
    this.eloScoreProvider = provider;
  }

  private computeTagScores(record: QuestionRecord, defaultScore: number): Map<string, number> {
    // Check for custom provider first
    if (this.eloScoreProvider) {
      const custom = this.eloScoreProvider.getTagScores(record, defaultScore);
      if (custom) return custom;
    }
    // Check for tagPerformance on record
    if (record.tagPerformance) {
      return new Map(Object.entries(record.tagPerformance));
    }
    // Fallback: null means use single score for all
    return null;
  }
}

// SessionController.ts - accept provider in config
constructor(..., config?: { eloScoreProvider?: EloScoreProvider })
```

---

## Clarification Prompts

Before proceeding to planning, please clarify:

### 1. Tag Granularity

Are SpellingQuestion cards tagged at GPC level (e.g., `c=/k/`, `a=/æ/`) or higher level (e.g., `CVC`, `short-a`)? 

If higher-level, the question view needs a mapping from character position → tag(s) to enable per-position scoring.

>>> IIUC, this Q is for follow-on implementation work for LP author (also me / us, but let's compartmentalize?). Generally, though, we expect to have cards for each GPC - gpc-c-K, gpc-c-S, gpc-i-IH, etc etc. Some other higher-level tags may / will exist, but impl can decide whether or not to explicitly grade them.

### 2. Digraph Handling

For words like "chat" (ch-a-t), should scoring be:
- 3 GPCs: `ch`, `a`, `t` — where "ch" is one unit
- 4 characters: `c`, `h`, `a`, `t` — each scored independently

This affects how `tagPerformance` keys are constructed.

>>> again this is downsteam work, but - GPC-ch-CH is an expected tag. So, the `ch` grapheme is graded as a unit.

### 3. Injection Mechanism Preference

Where should custom logic be injectable?

>>> Leaning away from injection - I think a generic response to `tagPerformance`s can satisfy immediate needs in the most straightforward way. Will require modification to existing responseProcessor, and as we do this work, we *may* find that we can't satisfy generality, and then fallback to injection.

- **Option 1**: `SessionController` constructor config (requires `StudySession` to pass it through)
- **Option 2**: `StudySession` props (add optional `sessionHooks` prop)
- **Option 3**: Provider/context pattern (LP provides context, framework consumes)
- **Option 4**: Global registration (register custom handler by course ID)

### 4. Scope of Change

Should this be:
- **Framework feature**: Useful for any course wanting granular tag scoring
- **LP-only**: Quick custom solution, not generalized

>>> framework feature. the existing grade-all-tags-as-one mechanism has serious deficiencies.

### 5. Fallback for Missing Tags

If `tagPerformance` references a tag not on the card's `cardElo.tags`, should we:
- Ignore it
- Create the tag ELO entry dynamically
- Log a warning

>>> Thinking right now: create the tag ELO entry dynamically. This makes question types themselves capable of self-tagging content that implement them.

---

## Next Steps

Once clarifications are provided, I'll produce `a.2.plan.md` with:
- Specific files to modify
- Interface definitions
- Implementation phases
- Success criteria
- Test strategy
