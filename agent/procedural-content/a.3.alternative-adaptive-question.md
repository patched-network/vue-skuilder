# Alternative Architecture: Adaptive Question Pattern

**Date**: 2026-01-13  
**Status**: Alternative Design (Simpler Path)  
**Builds on**: `a.1.assessment.md` — Option B (Adaptive Question)

---

## Motivation

The ProceduralContentSource architecture (Option E) is comprehensive but involves significant infrastructure changes. This document explores a simpler alternative that achieves similar goals with minimal framework modification.

The key insight: **Questions already have access to everything they need.**

When a Question is instantiated, it receives `ViewData[]` and can be augmented to receive additional context. If we inject skill state access, Questions can self-adapt.

---

## Core Concept

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      ADAPTIVE QUESTION FLOW                             │
│                                                                         │
│   1. DB Card with "template" ViewData (minimal params)                  │
│                          │                                              │
│                          ▼                                              │
│   2. CardHydration → injects SkillAccessor into Question               │
│                          │                                              │
│                          ▼                                              │
│   3. Question.constructor reads skill level, adjusts internal params   │
│                          │                                              │
│                          ▼                                              │
│   4. User interacts with Question                                       │
│                          │                                              │
│                          ▼                                              │
│   5. Question.evaluate() → returns Evaluation                          │
│                          │                                              │
│                          ▼                                              │
│   6. Question.adjustSkill() → updates skill level via SkillAccessor    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key difference from Option E**: No virtual cards, no new content source type. The existing DB card serves as a "skill anchor" and the Question class handles adaptation internally.

---

## Type Definitions

### SkillAccessor Interface

```typescript
// packages/common-ui/src/composables/SkillAccessor.ts

/**
 * Injected into adaptive questions to provide skill state access.
 * 
 * This interface abstracts the storage mechanism, allowing Questions
 * to read/write skill state without knowing about StrategyState, userDB, etc.
 */
export interface SkillAccessor {
  /**
   * Read current skill level for a dimension.
   * Returns null if no prior state exists.
   */
  getSkillLevel(skillId: string): Promise<SkillLevel | null>;
  
  /**
   * Update skill level after evaluation.
   */
  updateSkillLevel(skillId: string, update: SkillLevelUpdate): Promise<void>;
}

export interface SkillLevel {
  level: number;
  confidence: number;
  sampleCount: number;
}

export interface SkillLevelUpdate {
  newLevel: number;
  evaluation: {
    isCorrect: boolean;
    performance: number;
  };
}
```

### AdaptiveQuestion Base Class

```typescript
// packages/common-ui/src/composables/AdaptiveQuestion.ts

import { Question } from './Displayable';
import { Answer, Evaluation, ViewData } from '@vue-skuilder/common';

export interface AdaptiveQuestionOptions {
  skillAccessor: SkillAccessor;
}

/**
 * Base class for questions that adapt difficulty to user skill level.
 * 
 * Subclasses:
 * 1. Define a skillId for tracking
 * 2. Override adjustParams() to modify content based on skill level
 * 3. Override computeSkillUpdate() to define adaptation protocol
 */
export abstract class AdaptiveQuestion extends Question {
  /** Skill dimension this question adapts to */
  protected abstract readonly skillId: string;
  
  /** Default level for new users */
  protected abstract readonly defaultLevel: number;
  
  /** Skill accessor injected during construction */
  protected skillAccessor: SkillAccessor | null = null;
  
  /** Skill level at time of construction (for evaluation) */
  protected skillLevelAtConstruction: number;
  
  constructor(data: ViewData[], options?: AdaptiveQuestionOptions) {
    super(data);
    this.skillAccessor = options?.skillAccessor ?? null;
    this.skillLevelAtConstruction = this.defaultLevel;
  }
  
  /**
   * Called during construction to adjust internal parameters.
   * Subclasses should read skill level and modify content accordingly.
   */
  protected abstract adjustParams(skillLevel: number): void;
  
  /**
   * Compute the new skill level after evaluation.
   * Default implementation: Ericsson protocol (n+1 / n-2).
   */
  protected computeSkillUpdate(
    currentLevel: number,
    evaluation: Evaluation
  ): number {
    if (evaluation.isCorrect) {
      return currentLevel + 1;
    } else {
      return Math.max(1, currentLevel - 2);
    }
  }
  
  /**
   * Extended evaluate that also updates skill level.
   */
  public async evaluateAndAdapt(answer: Answer, timeSpent: number): Promise<Evaluation> {
    const evaluation = this.evaluate(answer, timeSpent);
    
    if (this.skillAccessor) {
      const newLevel = this.computeSkillUpdate(this.skillLevelAtConstruction, evaluation);
      
      await this.skillAccessor.updateSkillLevel(this.skillId, {
        newLevel,
        evaluation: {
          isCorrect: evaluation.isCorrect,
          performance: evaluation.performance,
        },
      });
    }
    
    return evaluation;
  }
  
  /**
   * Factory method: create instance with skill-adjusted params.
   * Called by CardHydrationService instead of direct construction.
   */
  static async createAdaptive<T extends AdaptiveQuestion>(
    QuestionClass: new (data: ViewData[], options?: AdaptiveQuestionOptions) => T,
    data: ViewData[],
    skillAccessor: SkillAccessor
  ): Promise<T> {
    // Read current skill level
    const skillId = new QuestionClass(data).skillId;  // Temporary instance to get skillId
    const skillState = await skillAccessor.getSkillLevel(skillId);
    const level = skillState?.level ?? new QuestionClass(data).defaultLevel;
    
    // Create real instance with options
    const instance = new QuestionClass(data, { skillAccessor });
    instance.skillLevelAtConstruction = level;
    instance.adjustParams(level);
    
    return instance;
  }
}
```

---

## Implementation Examples

### DigitSpanQuestion

```typescript
// packages/courseware/src/memory/questions/digit-span/index.ts

import { AdaptiveQuestion, AdaptiveQuestionOptions } from '@vue-skuilder/common-ui';
import { DataShape, DataShapeName, FieldType, ViewData, Answer } from '@vue-skuilder/common';
import DigitSpanView from './DigitSpanView.vue';

const dataShape: DataShape = {
  name: DataShapeName.MEMORY_DigitSpan,
  fields: [
    // Minimal seed data - actual length determined by skill level
    { name: 'presentationRate', type: FieldType.NUMBER },
  ],
};

export interface DigitSpanAnswer extends Answer {
  userSequence: string;
}

export class DigitSpanQuestion extends AdaptiveQuestion {
  static dataShapes = [dataShape];
  static views = [DigitSpanView];
  static acceptsUserData = false;
  static seedData = [{ presentationRate: 1000 }];  // Single card, infinite variations
  
  protected readonly skillId = 'digit-span';
  protected readonly defaultLevel = 4;
  
  // Computed at construction based on skill level
  private sequence: string = '';
  private sequenceLength: number = 4;
  private presentationRate: number;
  
  constructor(data: ViewData[], options?: AdaptiveQuestionOptions) {
    super(data, options);
    this.presentationRate = data[0].presentationRate as number;
    // adjustParams will be called after construction if using createAdaptive
  }
  
  protected adjustParams(skillLevel: number): void {
    this.sequenceLength = Math.round(skillLevel);
    this.sequence = this.generateSequence(this.sequenceLength);
    console.log(`[DigitSpan] Adjusted to length ${this.sequenceLength}`);
  }
  
  private generateSequence(length: number): string {
    const digits = '0123456789';
    let seq = '';
    for (let i = 0; i < length; i++) {
      seq += digits[Math.floor(Math.random() * 10)];
    }
    return seq;
  }
  
  // Getters for the view
  getSequence(): string { return this.sequence; }
  getSequenceLength(): number { return this.sequenceLength; }
  getPresentationRate(): number { return this.presentationRate; }
  
  protected isCorrect(answer: DigitSpanAnswer): boolean {
    return answer.userSequence === this.sequence;
  }
  
  protected displayedSkill(answer: DigitSpanAnswer, timeSpent: number): number {
    if (!this.isCorrect(answer)) return 0;
    
    // Perfect recall = 1.0, penalize for slow response
    const expectedTime = this.sequenceLength * this.presentationRate + 2000;
    const timePenalty = Math.max(0, 1 - (timeSpent - expectedTime) / 10000);
    return timePenalty;
  }
  
  // Override with Ericsson protocol
  protected computeSkillUpdate(currentLevel: number, evaluation: { isCorrect: boolean }): number {
    if (evaluation.isCorrect) {
      return currentLevel + 1;
    } else {
      return Math.max(3, currentLevel - 2);  // Floor at 3 digits
    }
  }
  
  dataShapes() { return DigitSpanQuestion.dataShapes; }
  views() { return DigitSpanQuestion.views; }
}
```

### AdaptiveFallingLettersQuestion

```typescript
// packages/courseware/src/typing/questions/falling-letters/AdaptiveFallingLettersQuestion.ts

import { AdaptiveQuestion, AdaptiveQuestionOptions } from '@vue-skuilder/common-ui';
import { ViewData } from '@vue-skuilder/common';
import { FallingLettersQuestion, Score } from './FallingLettersQuestion';

/**
 * Adaptive variant of FallingLettersQuestion.
 * 
 * Extends the existing question to add skill-based speed adjustment.
 * The base dataShape remains the same, but speed parameters are
 * overridden based on user's typing skill level.
 */
export class AdaptiveFallingLettersQuestion extends AdaptiveQuestion {
  static dataShapes = FallingLettersQuestion.dataShapes;
  static views = FallingLettersQuestion.views;
  static acceptsUserData = false;
  static seedData = FallingLettersQuestion.seedData;
  
  protected readonly skillId = 'typing-speed';
  protected readonly defaultLevel = 2.0;
  
  // Adapted parameters
  private gameLength: number;
  private initialSpeed: number;
  private acceleration: number;
  private spawnInterval: number;
  
  constructor(data: ViewData[], options?: AdaptiveQuestionOptions) {
    super(data, options);
    
    // Read base values from ViewData
    this.gameLength = data[0].gameLength as number;
    this.initialSpeed = data[0].initialSpeed as number;
    this.acceleration = data[0].acceleration as number;
    this.spawnInterval = data[0].spawnInterval as number;
  }
  
  protected adjustParams(skillLevel: number): void {
    // Scale speed based on skill level
    this.initialSpeed = skillLevel;
    this.acceleration = skillLevel * 0.05;
    this.spawnInterval = Math.max(0.3, 2 - skillLevel * 0.2);
    
    console.log(`[AdaptiveFallingLetters] Adjusted speed to ${this.initialSpeed}`);
  }
  
  // Getters for the view
  getGameLength(): number { return this.gameLength; }
  getInitialSpeed(): number { return this.initialSpeed; }
  getAcceleration(): number { return this.acceleration; }
  getSpawnInterval(): number { return this.spawnInterval; }
  
  protected isCorrect(answer: Score): boolean {
    return answer.win;
  }
  
  protected displayedSkill(answer: Score, _timeSpent: number): number {
    return answer.percentage;
  }
  
  // Gradient protocol: adjust based on performance
  protected computeSkillUpdate(
    currentLevel: number,
    evaluation: { performance: number }
  ): number {
    const targetPerformance = 0.77;  // 77% completion target
    const learningRate = 0.2;
    
    const error = evaluation.performance - targetPerformance;
    const adjustment = error * learningRate * currentLevel;
    
    return Math.max(1, Math.min(10, currentLevel + adjustment));
  }
  
  dataShapes() { return AdaptiveFallingLettersQuestion.dataShapes; }
  views() { return AdaptiveFallingLettersQuestion.views; }
}
```

---

## Integration Point: CardHydrationService

The key integration is in CardHydrationService, where we detect adaptive questions and use the factory method:

```typescript
// packages/db/src/study/services/CardHydrationService.ts

// Add to existing imports
import { AdaptiveQuestion, SkillAccessor } from '@vue-skuilder/common-ui';

// Add method to create SkillAccessor
private createSkillAccessor(user: UserDBInterface, courseId: string): SkillAccessor {
  return {
    async getSkillLevel(skillId: string): Promise<SkillLevel | null> {
      const state = await user.getStrategyState<SkillState>(courseId, `skill::${skillId}`);
      if (!state) return null;
      return {
        level: state.level,
        confidence: state.confidence,
        sampleCount: state.sampleCount,
      };
    },
    
    async updateSkillLevel(skillId: string, update: SkillLevelUpdate): Promise<void> {
      const existing = await user.getStrategyState<SkillState>(courseId, `skill::${skillId}`);
      const state: SkillState = existing || {
        level: update.newLevel,
        confidence: 0.1,
        sampleCount: 0,
        recentOutcomes: [],
        updatedAt: new Date().toISOString(),
      };
      
      state.level = update.newLevel;
      state.sampleCount++;
      state.recentOutcomes.push({
        timestamp: new Date().toISOString(),
        levelAttempted: state.level,
        performance: update.evaluation.performance,
        isCorrect: update.evaluation.isCorrect,
      });
      
      // Trim history
      if (state.recentOutcomes.length > 50) {
        state.recentOutcomes.shift();
      }
      
      await user.putStrategyState<SkillState>(courseId, `skill::${skillId}`, state);
    },
  };
}

// Modify hydrateCard to handle adaptive questions
private async hydrateCard(item: StudySessionItem): Promise<HydratedCard<TView> | null> {
  // ... existing fetch logic ...
  
  const QuestionClass = this.getViewComponent(questionTypeName);
  
  // Check if this is an adaptive question
  if (this.isAdaptiveQuestion(QuestionClass)) {
    const skillAccessor = this.createSkillAccessor(this.user, item.courseID);
    const instance = await AdaptiveQuestion.createAdaptive(
      QuestionClass as any,
      viewData,
      skillAccessor
    );
    
    return {
      cardID: item.cardID,
      courseID: item.courseID,
      questionClass: questionTypeName,
      viewData,
      questionInstance: instance,  // Pre-instantiated!
      elo: cardElo,
    };
  }
  
  // ... existing non-adaptive flow ...
}

private isAdaptiveQuestion(QuestionClass: any): boolean {
  // Check if class extends AdaptiveQuestion
  return QuestionClass.prototype instanceof AdaptiveQuestion;
}
```

---

## View Integration

Views for adaptive questions need to:
1. Call `evaluateAndAdapt()` instead of just `evaluate()`
2. Optionally display skill level UI

### Modified ViewableUtils Composable

```typescript
// packages/common-ui/src/composables/CompositionViewable.ts

export interface AdaptiveQuestionViewUtils<Q extends AdaptiveQuestion> extends QuestionViewUtils<Q> {
  skillLevel: Ref<number | null>;
  
  // Use this instead of submitAnswer for adaptive questions
  submitAdaptiveAnswer: (answer: Answer, submittingClass?: string) => Promise<QuestionRecord>;
}

export function useAdaptiveQuestionView<Q extends AdaptiveQuestion>(
  viewableUtils: ViewableUtils
): AdaptiveQuestionViewUtils<Q> {
  const baseUtils = useQuestionView<Q>(viewableUtils);
  const skillLevel = ref<number | null>(null);
  
  const submitAdaptiveAnswer = async (
    answer: Answer,
    submittingClass?: string
  ): Promise<QuestionRecord> => {
    const q = baseUtils.question.value;
    if (!q) throw new Error('No question available');
    
    // Use the extended evaluation that updates skill
    const evaluation = await q.evaluateAndAdapt(answer, Date.now() - viewableUtils.cardStartTime);
    
    // Update displayed skill level
    if (q.skillAccessor) {
      const state = await q.skillAccessor.getSkillLevel(q.skillId);
      skillLevel.value = state?.level ?? null;
    }
    
    // Continue with standard record creation
    return viewableUtils.createRecord(answer, evaluation, submittingClass);
  };
  
  return {
    ...baseUtils,
    skillLevel,
    submitAdaptiveAnswer,
  };
}
```

---

## Comparison with Option E

| Aspect | Option B (Adaptive Question) | Option E (ProceduralSource) |
|--------|-----------------------------|-----------------------------|
| **Infrastructure changes** | Minimal | Significant |
| **DB card required** | Yes (one card per skill) | No (virtual cards) |
| **Separation of concerns** | Question owns adaptation | Source owns adaptation |
| **Mixing with other content** | Automatic (same Pipeline) | Explicit (source registration) |
| **Skill state location** | StrategyState (same) | StrategyState (same) |
| **Question class changes** | Must extend AdaptiveQuestion | No Question changes |
| **Observability** | Via SkillAccessor callbacks | First-class skill endpoints |
| **Testability** | Harder (Question needs accessor) | Easier (source is isolated) |

---

## When to Choose Option B

**Choose Option B if:**
- You want to quickly prototype adaptive content
- You have existing questions to convert
- Minimal infrastructure change is important
- You're comfortable with Questions having state access

**Choose Option E if:**
- You want clean architectural separation
- You need observable skill progression
- You're building multiple procedural content types
- Long-term maintainability is priority

---

## Migration Path (Option B)

1. **Add SkillAccessor interface** to `common-ui` *(1 file)*
2. **Add AdaptiveQuestion base class** to `common-ui` *(1 file)*
3. **Extend CardHydrationService** to detect and handle adaptive questions *(~50 lines)*
4. **Create DigitSpanQuestion** as reference implementation *(1 file + view)*
5. **Create AdaptiveFallingLettersQuestion** wrapping existing *(1 file)*

**Estimated effort**: 2-3 days to functional prototype

---

## Evolution to Option E

If Option B proves the concept, evolving to Option E is straightforward:

1. Extract adaptation logic from Questions into Sources
2. Move skill state management to Sources
3. Questions become simpler (receive computed params, don't manage state)
4. Add virtual card infrastructure

The skill state format in StrategyState remains compatible.