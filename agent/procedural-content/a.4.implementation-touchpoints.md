# Implementation Touchpoints: Procedural Content

**Date**: 2026-01-13  
**Purpose**: Concrete code locations and modifications for procedural content support

---

## Executive Summary

This document maps the abstract designs from previous documents to specific files and functions in the codebase. It serves as a reference for implementation work.

---

## Part 1: Existing Code Understanding

### Content Flow Today

```
                    ┌─────────────────────────────────────────────────┐
                    │               AUTHORING TIME                    │
                    │                                                 │
                    │  Question.seedData → courseDB.addNote()         │
                    │         ↓                                       │
                    │  DisplayableData doc in course DB               │
                    │         ↓                                       │
                    │  Card doc created (links to DisplayableData)    │
                    └─────────────────────────────────────────────────┘
                                        │
                                        ▼
                    ┌─────────────────────────────────────────────────┐
                    │               RUNTIME SELECTION                 │
                    │                                                 │
  ELONavigator ────►│  getCardsCenteredAtELO()                       │
                    │         ↓                                       │
  SRSNavigator ────►│  getPendingReviews()                           │
                    │         ↓                                       │
                    │  Pipeline → Filters → WeightedCard[]            │
                    └─────────────────────────────────────────────────┘
                                        │
                                        ▼
                    ┌─────────────────────────────────────────────────┐
                    │               RUNTIME PRESENTATION              │
                    │                                                 │
                    │  SessionController._selectNextItemToHydrate()   │
                    │         ↓                                       │
                    │  CardHydrationService.hydrateCard()             │
                    │         ↓                                       │
                    │  displayableDataToViewData()                    │
                    │         ↓                                       │
                    │  Question constructor(ViewData[])               │
                    │         ↓                                       │
                    │  View component renders question                │
                    └─────────────────────────────────────────────────┘
```

### Key Files in Current Flow

| Stage | File | Key Function/Class |
|-------|------|-------------------|
| Seed Registration | `db/src/courseConfigRegistration.ts` | `registerSeedData()` |
| Card Storage | `common/src/course-data.ts` | `prepareNote55()` |
| Card Query | `db/src/impl/couch/courseDB.ts` | `getCardsCenteredAtELO()` |
| ELO Generation | `db/src/core/navigators/generators/elo.ts` | `ELONavigator.getWeightedCards()` |
| SRS Generation | `db/src/core/navigators/generators/srs.ts` | `SRSNavigator.getWeightedCards()` |
| Pipeline | `db/src/core/navigators/Pipeline.ts` | `Pipeline.getWeightedCards()` |
| Session Control | `db/src/study/SessionController.ts` | `SessionController` |
| Hydration | `db/src/study/services/CardHydrationService.ts` | `CardHydrationService.hydrateCard()` |
| Question Base | `common-ui/src/composables/Displayable.ts` | `Question` class |
| View Helpers | `common-ui/src/composables/CompositionViewable.ts` | `useQuestionView()` |

---

## Part 2: State Storage Infrastructure

### Existing: StrategyState

**Already Available** - No new infrastructure needed for skill state storage.

| File | Purpose |
|------|---------|
| `db/src/core/types/strategyState.ts` | Type definitions |
| `db/src/impl/common/BaseUserDB.ts` | `getStrategyState()`, `putStrategyState()` |
| `db/src/core/navigators/index.ts` | `ContentNavigator.getStrategyState()` (protected helper) |

**Current Usage Pattern:**
```typescript
// Reading state
const prefs = await this.getStrategyState<UserTagPreferenceState>();

// Writing state
await this.user.putStrategyState<SkillState>(courseId, 'skill::digit-span', state);
```

**Key Insight:** The `skill::` prefix convention is new, but the storage mechanism exists.

---

## Part 3: Option B Touchpoints (Adaptive Question)

### New Files to Create

| File | Purpose |
|------|---------|
| `common-ui/src/composables/SkillAccessor.ts` | Interface for skill state access |
| `common-ui/src/composables/AdaptiveQuestion.ts` | Base class for adaptive questions |
| `courseware/src/memory/questions/digit-span/DigitSpanQuestion.ts` | Reference implementation |
| `courseware/src/memory/questions/digit-span/DigitSpanView.vue` | View for digit span |

### Files to Modify

#### 1. CardHydrationService

**File:** `db/src/study/services/CardHydrationService.ts`

**Current State (L229-233):**
```typescript
const data = dataDocs.map(displayableDataToViewData).reverse();

this.hydratedCards.set(item.cardID, {
  // ...
});
```

**Modification Points:**
- Add `createSkillAccessor()` method (~30 lines)
- Add `isAdaptiveQuestion()` check (~5 lines)
- Modify `hydrateCard()` to branch for adaptive questions (~20 lines)

**Sketch:**
```typescript
// Add near top of class
private createSkillAccessor(courseId: string): SkillAccessor {
  const user = this.user;
  return {
    async getSkillLevel(skillId: string) {
      const state = await user.getStrategyState<SkillState>(courseId, `skill::${skillId}`);
      return state ? { level: state.level, confidence: state.confidence, sampleCount: state.sampleCount } : null;
    },
    async updateSkillLevel(skillId: string, update: SkillLevelUpdate) {
      // ... update logic
    }
  };
}

// In hydrateCard(), after getting QuestionClass:
if (this.isAdaptiveQuestion(QuestionClass)) {
  const accessor = this.createSkillAccessor(item.courseID);
  const instance = await AdaptiveQuestion.createAdaptive(QuestionClass, data, accessor);
  // Store instance differently...
}
```

#### 2. CompositionViewable

**File:** `common-ui/src/composables/CompositionViewable.ts`

**Current State (L82-95):**
```typescript
export function useQuestionView<Q extends Question>(
  viewableUtils: ViewableUtils
): QuestionViewUtils<Q> {
  // ...
}
```

**Modification Points:**
- Add `useAdaptiveQuestionView()` function (~40 lines)
- Export new types

#### 3. SessionController (Minor)

**File:** `db/src/study/SessionController.ts`

**Modification Points:**
- Ensure `submitResponse()` works with adaptive questions
- May need to call `evaluateAndAdapt()` instead of `evaluate()`

**Risk:** This is a critical path. Changes here need careful testing.

---

## Part 4: Option E Touchpoints (ProceduralContentSource)

### New Files to Create

| File | Purpose |
|------|---------|
| `db/src/core/types/skillState.ts` | SkillState, AdaptationProtocol types |
| `db/src/core/interfaces/proceduralContentSource.ts` | Interface definition |
| `db/src/core/procedural/BaseProceduralSource.ts` | Abstract base implementation |
| `db/src/core/procedural/protocols/ericsson.ts` | Ericsson protocol |
| `db/src/core/procedural/protocols/gradient.ts` | Gradient protocol |
| `db/src/core/procedural/DigitSpanProceduralSource.ts` | Reference: digit span |
| `db/src/core/procedural/TypingSpeedProceduralSource.ts` | Reference: typing |
| `db/src/core/procedural/index.ts` | Exports |

### Files to Modify

#### 1. CardHydrationService (Significant)

**File:** `db/src/study/services/CardHydrationService.ts`

**Modifications:**
- Add `proceduralSources: Map<string, ProceduralContentSource>`
- Add `registerProceduralSource()` method
- Add `virtualCardParams: Map<string, DifficultyParams>` cache
- Add `hydrateVirtualCard()` method (~50 lines)
- Modify `hydrateCard()` to check for virtual cards (~10 lines)

**Virtual Card Detection:**
```typescript
if (item.cardID.startsWith('VIRTUAL::')) {
  return this.hydrateVirtualCard(item);
}
```

#### 2. SessionController (Moderate)

**File:** `db/src/study/SessionController.ts`

**Modifications:**
- Add `proceduralSources: Map<string, ProceduralContentSource>`
- Add `registerProceduralSource()` method
- Add `virtualCardSources: Map<string, string>` (cardId → sourceId)
- Extend `getWeightedContent()` to track virtual cards
- Add `recordProceduralOutcome()` method (~20 lines)
- Modify `submitResponse()` to route virtual card outcomes

#### 3. StudyContentSource Interface

**File:** `db/src/core/interfaces/contentSource.ts`

**Current State (L67-70):**
```typescript
interface StudyContentSource {
  getWeightedCards(limit: number): Promise<WeightedCard[]>;
}
```

**Modification:** `ProceduralContentSource` extends this, no breaking change.

#### 4. Pipeline Assembly

**File:** `db/src/core/navigators/PipelineAssembler.ts`

**Consideration:** Should procedural sources participate in Pipeline, or be separate?

**Recommendation:** Keep procedural sources as separate `StudyContentSource` instances, mixed at the `SessionController.sources` level rather than within Pipeline.

---

## Part 5: Shared Infrastructure (Both Options)

### SkillState Type

Both options need the same skill state structure:

```typescript
// db/src/core/types/skillState.ts

export interface SkillState {
  level: number;
  confidence: number;
  sampleCount: number;
  recentOutcomes: RecentOutcome[];
  updatedAt: string;
  protocolState?: Record<string, unknown>;
}

export interface RecentOutcome {
  timestamp: string;
  levelAttempted: number;
  performance: number;
  isCorrect: boolean;
}

export const RECENT_OUTCOME_LIMIT = 50;
```

### Adaptation Protocol Types

```typescript
// db/src/core/types/skillState.ts (continued)

export interface AdaptationProtocol {
  id: string;
  computeNextLevel(state: SkillState, outcome: { performance: number; isCorrect: boolean }): number;
  computeNextConfidence(state: SkillState, outcome: { performance: number; isCorrect: boolean }): number;
}
```

---

## Part 6: Testing Strategy

### Unit Tests

| Test Target | Location |
|-------------|----------|
| SkillState updates | `db/tests/core/types/skillState.test.ts` |
| AdaptiveQuestion base | `common-ui/tests/composables/AdaptiveQuestion.test.ts` |
| Ericsson protocol | `db/tests/core/procedural/protocols/ericsson.test.ts` |
| BaseProceduralSource | `db/tests/core/procedural/BaseProceduralSource.test.ts` |

### Integration Tests

| Test Target | Location |
|-------------|----------|
| CardHydration with adaptive | `db/tests/study/CardHydrationService.adaptive.test.ts` |
| SessionController with virtual cards | `db/tests/study/SessionController.procedural.test.ts` |
| Full pipeline with mixed content | `e2e-testing/tests/procedural/mixed-session.test.ts` |

### E2E Scenarios

1. **Ericsson Protocol E2E**
   - User starts with 4-digit sequence
   - Correct answers increase to 5, 6, 7...
   - Incorrect answer drops by 2
   - State persists across sessions

2. **Mixed Content E2E**
   - Session mixes DB cards with procedural content
   - Both types are scheduled appropriately
   - ELO updates for DB cards, skill updates for procedural

---

## Part 7: Risk Assessment

### High Risk Modifications

| File | Risk | Mitigation |
|------|------|------------|
| `SessionController.ts` | Critical path, session stability | Extensive testing, feature flag |
| `CardHydrationService.ts` | Affects all card presentation | Branch for virtual only, don't modify existing path |

### Medium Risk Additions

| Addition | Risk | Mitigation |
|----------|------|------------|
| `AdaptiveQuestion` base class | Subclass compatibility | Keep minimal, provide defaults |
| `ProceduralContentSource` interface | Future lock-in | Design for extension |

### Low Risk Changes

| Change | Notes |
|--------|-------|
| `SkillState` type | Additive, no breaking changes |
| Protocol implementations | Isolated, easily tested |
| New courseware questions | Opt-in, no effect on existing |

---

## Part 8: Incremental Delivery

### Phase 1: Infrastructure (No Runtime Changes)

**Deliverables:**
- `skillState.ts` types
- `AdaptiveQuestion` base class (or `ProceduralContentSource` interface)
- Adaptation protocols
- Unit tests for all new types

**Validation:** All tests pass, no runtime behavior changes

### Phase 2: Integration Hooks

**Deliverables:**
- `CardHydrationService` modifications
- `SessionController` modifications (behind feature flag)
- Integration tests

**Validation:** Existing card flow works unchanged, new flow works when enabled

### Phase 3: Reference Implementation

**Deliverables:**
- `DigitSpanQuestion` (or `DigitSpanProceduralSource`)
- `DigitSpanView.vue`
- E2E test for digit span progression

**Validation:** Full Ericsson protocol demonstrated

### Phase 4: FallingLetters Integration

**Deliverables:**
- `AdaptiveFallingLettersQuestion` (or `TypingSpeedProceduralSource`)
- Updated view to display skill level
- E2E test for typing speed progression

**Validation:** Existing FallingLetters users get adaptive behavior

---

## Part 9: Existing Pattern Reference

### ForkFinder as Precedent

**File:** `courseware/src/chess/questions/forks/index.ts`

ForkFinder already demonstrates:
- `acceptsUserData = false` (closed content)
- Constructor generates content via `generatePositions()`
- Single seed data entry creates many variations

**Limitation:** No skill state tracking, no adaptation.

**Extension Path:** Create `AdaptiveForkFinder` that:
1. Reads skill level for fork complexity
2. Adjusts `numTargets`, piece types based on level
3. Updates skill state on evaluation

### SingleDigitAddition as Pattern

**File:** `courseware/src/math/questions/addition/index.ts`

Demonstrates:
- `seedData` generating all combinations
- `acceptsUserData = false`

**Why Not Adaptive:** Finite, discrete content. All 0+0 through 9+9 are stored as cards.

**Insight:** Adaptive questions make sense for continuous or infinite content spaces.

---

## Part 10: Decision Points

### Question 1: Where Does Skill Adjustment Happen?

| Option | Location | Trade-off |
|--------|----------|-----------|
| A | In Question class (Option B) | Simple, but Questions get stateful |
| B | In ProceduralSource (Option E) | Clean separation, more infrastructure |
| C | In SessionController | Central control, but couples concerns |

**Recommendation:** Start with Option B for speed, migrate to Option E for scale.

### Question 2: Virtual Cards or Template Cards?

| Approach | Description | Trade-off |
|----------|-------------|-----------|
| Virtual | No DB storage, generated on-demand | Clean, but no history |
| Template | Single DB card, params computed at runtime | Has history, but mixed semantics |

**Recommendation:** Template cards (Option B) for MVP, virtual cards (Option E) for full solution.

### Question 3: Skill State Scope?

| Scope | Description | Trade-off |
|-------|-------------|-----------|
| Per-course | Skills tracked per user per course | Isolated, but no transfer |
| Global | Skills tracked globally per user | Transfers, but courses can't customize |

**Recommendation:** Per-course initially, consider global later for cross-course skills.

---

## Appendix: File Inventory

### New Files (Option B MVP)

```
common-ui/
  src/
    composables/
      SkillAccessor.ts          # ~30 lines
      AdaptiveQuestion.ts       # ~100 lines
  tests/
    composables/
      AdaptiveQuestion.test.ts  # ~100 lines

courseware/
  src/
    memory/
      questions/
        digit-span/
          DigitSpanQuestion.ts  # ~80 lines
          DigitSpanView.vue     # ~100 lines
          index.ts              # ~10 lines

db/
  src/
    core/
      types/
        skillState.ts           # ~50 lines
```

### Modified Files (Option B MVP)

```
db/
  src/
    study/
      services/
        CardHydrationService.ts  # +60 lines
    SessionController.ts         # +20 lines
```

**Total New Code:** ~470 lines
**Total Modified Code:** ~80 lines