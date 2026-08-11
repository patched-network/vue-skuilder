# Architecture Sketch: ProceduralContentSource

**Date**: 2026-01-13  
**Status**: Draft / Design Proposal  
**Builds on**: `a.1.assessment.md` — Option E (Hybrid ProceduralContentSource + SkillState)

---

## Overview

This document details the architecture for procedurally-generated, skill-adaptive content. The core idea is:

1. **SkillState**: Per-user, per-skill difficulty tracking stored in StrategyState
2. **ProceduralContentSource**: A content source that generates virtual cards targeting current skill level
3. **Adaptive Feedback Loop**: Skill state updates based on observed performance

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SKILL-ADAPTIVE LOOP                             │
│                                                                         │
│   SkillState ──────► ProceduralContentSource ──────► VirtualCard       │
│       ▲                                                    │            │
│       │                                                    ▼            │
│       │                                            CardHydration       │
│       │                                                    │            │
│       │                                                    ▼            │
│       │                                            Question Instance   │
│       │                                                    │            │
│       │                                                    ▼            │
│       │                                            User Response       │
│       │                                                    │            │
│       └────────────────── recordOutcome ◄──────────────────┘            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Part 1: SkillState

### Type Definition

```typescript
// packages/db/src/core/types/skillState.ts

/**
 * Persistent state for a user's skill level on a continuous dimension.
 * 
 * Examples:
 * - Digit span length (Ericsson protocol)
 * - Typing speed (letters per minute)
 * - Chess puzzle difficulty (rating)
 */
export interface SkillState {
  /** Current skill level (interpretation depends on skill type) */
  level: number;
  
  /** Confidence in the current level estimate (0-1) */
  confidence: number;
  
  /** Total number of observations */
  sampleCount: number;
  
  /** Rolling statistics for adaptation algorithms */
  recentOutcomes: RecentOutcome[];
  
  /** Last update timestamp */
  updatedAt: string;
  
  /** Optional: Skill-specific protocol state */
  protocolState?: Record<string, unknown>;
}

export interface RecentOutcome {
  timestamp: string;
  levelAttempted: number;
  performance: number;  // 0-1 from Evaluation.performance
  isCorrect: boolean;
}

/** Maximum recent outcomes to retain for rolling calculations */
export const RECENT_OUTCOME_LIMIT = 50;
```

### Storage Convention

Skills are stored in StrategyState with a `skill::` prefix:

```typescript
// Key: `skill::${skillId}`
// Example: `skill::digit-span`, `skill::typing-speed-letters`

await userDB.putStrategyState<SkillState>(
  courseId,
  `skill::digit-span`,
  skillState
);
```

### Adaptation Protocols

Different skills may use different adaptation algorithms. Define as strategy:

```typescript
/**
 * Adaptation protocol determines how skill level updates after each outcome.
 */
export interface AdaptationProtocol {
  /** Unique identifier */
  id: string;
  
  /** Compute next level given current state and new outcome */
  computeNextLevel(
    currentState: SkillState,
    outcome: { performance: number; isCorrect: boolean }
  ): number;
  
  /** Compute confidence update */
  computeNextConfidence(
    currentState: SkillState,
    outcome: { performance: number; isCorrect: boolean }
  ): number;
}
```

#### Built-in Protocols

**1. Ericsson Protocol (Discrete Jump)**
```typescript
export const ericssonProtocol: AdaptationProtocol = {
  id: 'ericsson',
  
  computeNextLevel(state, outcome) {
    if (outcome.isCorrect) {
      return state.level + 1;
    } else {
      return Math.max(state.level - 2, 1);  // Floor at 1
    }
  },
  
  computeNextConfidence(state, _outcome) {
    // Confidence grows with sample count
    return Math.min(0.95, 0.5 + state.sampleCount * 0.01);
  }
};
```

**2. Gradient Protocol (Continuous Adjustment)**
```typescript
export const gradientProtocol: AdaptationProtocol = {
  id: 'gradient',
  
  computeNextLevel(state, outcome) {
    // Target performance zone: 70-85% success rate
    const targetPerformance = 0.77;
    const learningRate = 0.1;
    
    // If performing above target, increase difficulty
    // If performing below target, decrease difficulty
    const error = outcome.performance - targetPerformance;
    return state.level + error * learningRate * state.level;
  },
  
  computeNextConfidence(state, outcome) {
    // Confidence increases when outcomes match predictions
    const recentMean = state.recentOutcomes
      .slice(-10)
      .reduce((sum, o) => sum + o.performance, 0) / 10;
    const deviation = Math.abs(outcome.performance - recentMean);
    
    // High deviation = low confidence
    return Math.min(0.95, state.confidence + (0.1 - deviation) * 0.1);
  }
};
```

**3. Staircase Protocol (Psychophysics Style)**
```typescript
export const staircaseProtocol: AdaptationProtocol = {
  id: 'staircase',
  
  computeNextLevel(state, outcome) {
    const protocol = state.protocolState as { 
      consecutiveCorrect: number; 
      consecutiveIncorrect: number;
      stepSize: number;
    };
    
    if (outcome.isCorrect) {
      const consec = (protocol?.consecutiveCorrect || 0) + 1;
      // 3-up: increase after 3 consecutive correct
      if (consec >= 3) {
        return state.level + (protocol?.stepSize || 1);
      }
    } else {
      // 1-down: decrease after any incorrect
      return state.level - (protocol?.stepSize || 1);
    }
    
    return state.level;
  },
  
  computeNextConfidence(state, _outcome) {
    // Confidence based on reversal count
    return Math.min(0.95, 0.5 + state.sampleCount * 0.005);
  }
};
```

---

## Part 2: ProceduralContentSource

### Interface Definition

```typescript
// packages/db/src/core/interfaces/proceduralContentSource.ts

import { StudyContentSource, StudySessionItem } from './contentSource';
import { WeightedCard } from '../navigators';
import { Evaluation } from '@vue-skuilder/common';
import { SkillState, AdaptationProtocol } from '../types/skillState';

/**
 * A content source that procedurally generates content based on user skill state.
 * 
 * Unlike CardGenerator which queries existing cards, ProceduralContentSource
 * synthesizes content at the user's current skill level.
 */
export interface ProceduralContentSource extends StudyContentSource {
  /** Skill dimension this source targets */
  readonly skillId: string;
  
  /** Human-readable name for UI */
  readonly displayName: string;
  
  /** The adaptation protocol used for this skill */
  readonly protocol: AdaptationProtocol;
  
  /**
   * Get weighted virtual cards targeting current skill level.
   * Cards returned have `isVirtual: true` and `difficultyParams`.
   */
  getWeightedCards(limit: number): Promise<ProceduralWeightedCard[]>;
  
  /**
   * Generate ViewData for a virtual card.
   * Called by CardHydrationService when hydrating virtual cards.
   */
  generateContent(cardId: string, params: DifficultyParams): Promise<ViewData[]>;
  
  /**
   * Record outcome and update skill state.
   * Called after user response to virtual card.
   */
  recordOutcome(cardId: string, evaluation: Evaluation): Promise<void>;
  
  /**
   * Get current skill state for debugging/visualization.
   */
  getSkillState(): Promise<SkillState>;
}

/**
 * Extended WeightedCard for procedurally generated content.
 */
export interface ProceduralWeightedCard extends WeightedCard {
  /** Marker for virtual cards (not in DB) */
  isVirtual: true;
  
  /** Skill dimension this card targets */
  skillId: string;
  
  /** Parameters used to generate content */
  difficultyParams: DifficultyParams;
  
  /** Reference to the source for hydration callback */
  sourceId: string;
}

/**
 * Parameters that control procedural content difficulty.
 * Interpretation is skill-specific.
 */
export interface DifficultyParams {
  /** Primary difficulty dimension */
  level: number;
  
  /** Additional parameters (skill-specific) */
  [key: string]: number | string | boolean;
}

/**
 * Type guard for virtual cards.
 */
export function isVirtualCard(card: WeightedCard): card is ProceduralWeightedCard {
  return 'isVirtual' in card && card.isVirtual === true;
}
```

### Abstract Base Implementation

```typescript
// packages/db/src/core/procedural/BaseProceduralSource.ts

import { UserDBInterface, CourseDBInterface } from '../interfaces';
import { ProceduralContentSource, ProceduralWeightedCard, DifficultyParams } from '../interfaces/proceduralContentSource';
import { SkillState, AdaptationProtocol, RECENT_OUTCOME_LIMIT } from '../types/skillState';
import { ViewData, Evaluation } from '@vue-skuilder/common';
import { v4 as uuid } from 'uuid';
import { logger } from '../../util/logger';

/**
 * Abstract base class for procedural content sources.
 * Handles skill state management; subclasses implement content generation.
 */
export abstract class BaseProceduralSource implements ProceduralContentSource {
  abstract readonly skillId: string;
  abstract readonly displayName: string;
  abstract readonly protocol: AdaptationProtocol;
  
  /** Question class name for hydration */
  abstract readonly questionClass: string;
  
  /** Initial skill level for new users */
  abstract readonly initialLevel: number;
  
  protected user: UserDBInterface;
  protected course: CourseDBInterface;
  
  private _skillState: SkillState | null = null;
  private sourceId: string;
  
  constructor(user: UserDBInterface, course: CourseDBInterface) {
    this.user = user;
    this.course = course;
    this.sourceId = `procedural::${this.skillId}::${uuid().slice(0, 8)}`;
  }
  
  // ────────────────────────────────────────────────────────────────────
  // SKILL STATE MANAGEMENT
  // ────────────────────────────────────────────────────────────────────
  
  async getSkillState(): Promise<SkillState> {
    if (this._skillState) return this._skillState;
    
    const stored = await this.user.getStrategyState<SkillState>(
      this.course.getCourseID(),
      `skill::${this.skillId}`
    );
    
    if (stored) {
      this._skillState = stored;
    } else {
      this._skillState = this.createInitialState();
    }
    
    return this._skillState;
  }
  
  private createInitialState(): SkillState {
    return {
      level: this.initialLevel,
      confidence: 0.1,
      sampleCount: 0,
      recentOutcomes: [],
      updatedAt: new Date().toISOString(),
    };
  }
  
  private async saveSkillState(state: SkillState): Promise<void> {
    state.updatedAt = new Date().toISOString();
    this._skillState = state;
    
    await this.user.putStrategyState<SkillState>(
      this.course.getCourseID(),
      `skill::${this.skillId}`,
      state
    );
  }
  
  // ────────────────────────────────────────────────────────────────────
  // WEIGHTED CARDS
  // ────────────────────────────────────────────────────────────────────
  
  async getWeightedCards(limit: number): Promise<ProceduralWeightedCard[]> {
    const state = await this.getSkillState();
    const cards: ProceduralWeightedCard[] = [];
    
    for (let i = 0; i < limit; i++) {
      const params = this.computeDifficultyParams(state, i);
      const cardId = `VIRTUAL::${this.skillId}::${uuid()}`;
      
      cards.push({
        cardId,
        courseId: this.course.getCourseID(),
        score: this.computeCardScore(state, params),
        isVirtual: true,
        skillId: this.skillId,
        difficultyParams: params,
        sourceId: this.sourceId,
        provenance: [{
          strategy: 'procedural',
          strategyName: this.displayName,
          strategyId: `PROCEDURAL::${this.skillId}`,
          action: 'generated',
          score: 1.0,
          reason: `Generated at level ${params.level.toFixed(2)} (confidence: ${state.confidence.toFixed(2)})`,
        }],
      });
    }
    
    return cards;
  }
  
  /**
   * Compute difficulty parameters for content generation.
   * Base implementation uses current level; subclasses can add variation.
   */
  protected computeDifficultyParams(state: SkillState, _index: number): DifficultyParams {
    return { level: state.level };
  }
  
  /**
   * Compute card score (suitability for presentation).
   * Higher confidence = higher score (we're confident this is appropriate).
   */
  protected computeCardScore(state: SkillState, _params: DifficultyParams): number {
    return 0.5 + state.confidence * 0.5;  // Range [0.5, 1.0]
  }
  
  // ────────────────────────────────────────────────────────────────────
  // CONTENT GENERATION (Abstract)
  // ────────────────────────────────────────────────────────────────────
  
  /**
   * Generate ViewData for a card with given difficulty params.
   * Subclasses implement content-specific generation logic.
   */
  abstract generateContent(cardId: string, params: DifficultyParams): Promise<ViewData[]>;
  
  // ────────────────────────────────────────────────────────────────────
  // OUTCOME RECORDING
  // ────────────────────────────────────────────────────────────────────
  
  async recordOutcome(cardId: string, evaluation: Evaluation): Promise<void> {
    const state = await this.getSkillState();
    
    // Extract level from cardId metadata (stored when generated)
    const levelAttempted = this.extractLevelFromCardId(cardId) ?? state.level;
    
    // Record outcome
    const outcome = {
      timestamp: new Date().toISOString(),
      levelAttempted,
      performance: evaluation.performance,
      isCorrect: evaluation.isCorrect,
    };
    
    state.recentOutcomes.push(outcome);
    if (state.recentOutcomes.length > RECENT_OUTCOME_LIMIT) {
      state.recentOutcomes.shift();
    }
    
    // Update level and confidence via protocol
    const newLevel = this.protocol.computeNextLevel(state, {
      performance: evaluation.performance,
      isCorrect: evaluation.isCorrect,
    });
    
    const newConfidence = this.protocol.computeNextConfidence(state, {
      performance: evaluation.performance,
      isCorrect: evaluation.isCorrect,
    });
    
    logger.info(
      `[${this.skillId}] Outcome: ${evaluation.isCorrect ? '✓' : '✗'} ` +
      `(${(evaluation.performance * 100).toFixed(0)}%) → ` +
      `level ${state.level.toFixed(2)} → ${newLevel.toFixed(2)}`
    );
    
    state.level = newLevel;
    state.confidence = newConfidence;
    state.sampleCount++;
    
    // Allow subclass to update protocol-specific state
    state.protocolState = this.updateProtocolState(state, evaluation);
    
    await this.saveSkillState(state);
  }
  
  /**
   * Hook for subclasses to update protocol-specific state.
   */
  protected updateProtocolState(
    _state: SkillState,
    _evaluation: Evaluation
  ): Record<string, unknown> | undefined {
    return undefined;
  }
  
  /**
   * Extract level from virtual card ID.
   * Format: VIRTUAL::{skillId}::{uuid}
   */
  private extractLevelFromCardId(_cardId: string): number | null {
    // Level is stored in difficultyParams, not in ID
    // This would require a lookup or caching mechanism
    return null;
  }
  
  // ────────────────────────────────────────────────────────────────────
  // METADATA
  // ────────────────────────────────────────────────────────────────────
  
  getCourseID(): string {
    return this.course.getCourseID();
  }
  
  getSourceId(): string {
    return this.sourceId;
  }
}
```

---

## Part 3: Integration Points

### CardHydrationService Extension

```typescript
// packages/db/src/study/services/CardHydrationService.ts

// Add to existing imports
import { isVirtualCard, ProceduralWeightedCard } from '@db/core/interfaces/proceduralContentSource';

// Add registry for procedural sources
private proceduralSources: Map<string, ProceduralContentSource> = new Map();

public registerProceduralSource(source: ProceduralContentSource): void {
  this.proceduralSources.set(source.getSourceId(), source);
}

// Modify hydrateCard to handle virtual cards
private async hydrateCard(item: StudySessionItem): Promise<HydratedCard<TView> | null> {
  // Check if virtual
  if (item.cardID.startsWith('VIRTUAL::')) {
    return this.hydrateVirtualCard(item);
  }
  
  // Existing implementation for DB cards...
}

private async hydrateVirtualCard(item: StudySessionItem): Promise<HydratedCard<TView> | null> {
  // Find the source that generated this card
  // Note: We need to store sourceId on StudySessionItem or use a cache
  
  const sourceId = this.virtualCardSources.get(item.cardID);
  if (!sourceId) {
    logger.error(`[CardHydration] No source found for virtual card ${item.cardID}`);
    return null;
  }
  
  const source = this.proceduralSources.get(sourceId);
  if (!source) {
    logger.error(`[CardHydration] Procedural source ${sourceId} not registered`);
    return null;
  }
  
  // Get params from cache (stored when card was added to queue)
  const params = this.virtualCardParams.get(item.cardID);
  if (!params) {
    logger.error(`[CardHydration] No params cached for virtual card ${item.cardID}`);
    return null;
  }
  
  // Generate content
  const viewData = await source.generateContent(item.cardID, params);
  
  // Get question class
  const QuestionClass = this.getQuestionClass(source.questionClass);
  if (!QuestionClass) {
    logger.error(`[CardHydration] Unknown question class ${source.questionClass}`);
    return null;
  }
  
  return {
    cardID: item.cardID,
    courseID: item.courseID,
    questionClass: source.questionClass,
    viewData,
    // Virtual cards don't have card ELO in the traditional sense
    elo: { global: { score: params.level * 100, count: 0 }, tags: {} },
  };
}
```

### SessionController Extension

```typescript
// packages/db/src/study/SessionController.ts

// Add to imports
import { ProceduralContentSource, isVirtualCard } from '@db/core/interfaces/proceduralContentSource';

// Track procedural sources
private proceduralSources: Map<string, ProceduralContentSource> = new Map();

// Register sources in constructor or setup
public registerProceduralSource(source: ProceduralContentSource): void {
  this.proceduralSources.set(source.getSourceId(), source);
  this.hydrationService.registerProceduralSource(source);
}

// Extend submitResponse to route outcomes
public async submitResponse(
  cardRecord: CardRecord,
  // ... existing params
): Promise<ResponseResult> {
  // ... existing implementation ...
  
  // After processing, check if virtual card and route outcome
  if (currentCard.item.cardID.startsWith('VIRTUAL::')) {
    await this.recordProceduralOutcome(currentCard, evaluation);
  }
  
  return result;
}

private async recordProceduralOutcome(
  card: StudySessionRecord,
  evaluation: Evaluation
): Promise<void> {
  // Find source from cached mapping
  const sourceId = this.virtualCardSources.get(card.item.cardID);
  if (!sourceId) return;
  
  const source = this.proceduralSources.get(sourceId);
  if (!source) return;
  
  await source.recordOutcome(card.item.cardID, evaluation);
}
```

### SourceMixer Integration

Procedural sources can participate in source mixing:

```typescript
// ProceduralContentSource implements StudyContentSource,
// so it can be passed to SessionController.sources

const digitSpanSource = new DigitSpanProceduralSource(user, course);
const cardSource = await courseDB.createNavigator();

const controller = new SessionController(
  [cardSource, digitSpanSource],  // Mix procedural with DB content
  sessionDuration,
  dataLayer,
  getViewComponent
);

controller.registerProceduralSource(digitSpanSource);
```

---

## Part 4: Reference Implementations

### DigitSpanProceduralSource

```typescript
// packages/db/src/core/procedural/DigitSpanProceduralSource.ts

import { BaseProceduralSource } from './BaseProceduralSource';
import { ericssonProtocol, AdaptationProtocol, SkillState } from '../types/skillState';
import { DifficultyParams } from '../interfaces/proceduralContentSource';
import { ViewData, Evaluation } from '@vue-skuilder/common';

export class DigitSpanProceduralSource extends BaseProceduralSource {
  readonly skillId = 'digit-span';
  readonly displayName = 'Digit Span Memory';
  readonly protocol = ericssonProtocol;
  readonly questionClass = 'DigitSpanQuestion';
  readonly initialLevel = 4;  // Start with 4-digit sequences
  
  async generateContent(cardId: string, params: DifficultyParams): Promise<ViewData[]> {
    const length = Math.round(params.level);
    const sequence = this.generateSequence(length);
    
    return [{
      sequenceLength: length,
      sequence: sequence,
      presentationRate: 1000,  // 1 second per digit
    }];
  }
  
  private generateSequence(length: number): string {
    const digits = '0123456789';
    let seq = '';
    for (let i = 0; i < length; i++) {
      seq += digits[Math.floor(Math.random() * 10)];
    }
    return seq;
  }
  
  protected updateProtocolState(
    state: SkillState,
    evaluation: Evaluation
  ): Record<string, unknown> {
    // Track consecutive correct/incorrect for staircase variant
    const current = state.protocolState as {
      consecutiveCorrect?: number;
      consecutiveIncorrect?: number;
    } || {};
    
    if (evaluation.isCorrect) {
      return {
        consecutiveCorrect: (current.consecutiveCorrect || 0) + 1,
        consecutiveIncorrect: 0,
      };
    } else {
      return {
        consecutiveCorrect: 0,
        consecutiveIncorrect: (current.consecutiveIncorrect || 0) + 1,
      };
    }
  }
}
```

### TypingSpeedProceduralSource

```typescript
// packages/db/src/core/procedural/TypingSpeedProceduralSource.ts

import { BaseProceduralSource } from './BaseProceduralSource';
import { gradientProtocol, AdaptationProtocol } from '../types/skillState';
import { DifficultyParams } from '../interfaces/proceduralContentSource';
import { ViewData } from '@vue-skuilder/common';

export class TypingSpeedProceduralSource extends BaseProceduralSource {
  readonly skillId = 'typing-speed';
  readonly displayName = 'Adaptive Typing Speed';
  readonly protocol = gradientProtocol;
  readonly questionClass = 'FallingLettersQuestion';
  readonly initialLevel = 2.0;  // Initial speed parameter
  
  async generateContent(cardId: string, params: DifficultyParams): Promise<ViewData[]> {
    const speed = params.level;
    
    return [{
      gameLength: 30,
      initialSpeed: speed,
      acceleration: speed * 0.05,  // 5% acceleration
      spawnInterval: Math.max(0.3, 2 - speed * 0.2),  // Faster spawn at higher levels
    }];
  }
  
  protected computeDifficultyParams(state, index): DifficultyParams {
    // Add slight variation around current level
    const variation = (Math.random() - 0.5) * 0.2;
    return { level: Math.max(1, state.level + variation) };
  }
}
```

---

## Part 5: Observability

### Skill Progression Dashboard

Expose skill states via API endpoints:

```typescript
// packages/express/src/routes/skills.ts

router.get('/:courseId/skills', async (req, res) => {
  const { courseId } = req.params;
  const user = await getAuthenticatedUser(req);
  
  // Get all skill states for this user/course
  const skillKeys = await user.getStrategyStateKeys(courseId, 'skill::');
  
  const skills = await Promise.all(
    skillKeys.map(async (key) => {
      const skillId = key.replace('skill::', '');
      const state = await user.getStrategyState<SkillState>(courseId, key);
      return { skillId, state };
    })
  );
  
  res.json({ skills });
});

router.get('/:courseId/skills/:skillId/history', async (req, res) => {
  const { courseId, skillId } = req.params;
  const user = await getAuthenticatedUser(req);
  
  const state = await user.getStrategyState<SkillState>(courseId, `skill::${skillId}`);
  
  res.json({
    skillId,
    currentLevel: state?.level,
    confidence: state?.confidence,
    recentOutcomes: state?.recentOutcomes || [],
  });
});
```

### Skill Visualization Component

```vue
<!-- packages/platform-ui/src/components/SkillProgressionChart.vue -->

<template>
  <v-card>
    <v-card-title>{{ skill.displayName }}</v-card-title>
    <v-card-text>
      <div class="skill-level">
        Level: {{ skill.state.level.toFixed(2) }}
        <v-chip :color="confidenceColor" size="small">
          {{ (skill.state.confidence * 100).toFixed(0) }}% confidence
        </v-chip>
      </div>
      
      <apexchart
        type="line"
        :options="chartOptions"
        :series="chartSeries"
        height="200"
      />
    </v-card-text>
  </v-card>
</template>
```

---

## Part 6: Migration Path

### Phase 1: Infrastructure (No Breaking Changes)

1. Add `SkillState` type to `@vue-skuilder/db`
2. Add `ProceduralContentSource` interface
3. Add `BaseProceduralSource` abstract class
4. Add virtual card detection utilities

### Phase 2: Integration Hooks

1. Extend `CardHydrationService` with virtual card handling
2. Extend `SessionController` with procedural outcome routing
3. Register procedural sources in course setup

### Phase 3: Reference Implementations

1. Implement `DigitSpanProceduralSource` + `DigitSpanQuestion`
2. Adapt `FallingLettersQuestion` for procedural sourcing
3. Validate mixed sessions (procedural + DB content)

### Phase 4: Observability

1. Add skill progression API endpoints
2. Add dashboard visualizations
3. Integrate with evolutionary orchestration (optional)

---

## Open Questions

1. **Card History for Virtual Cards**: Should we persist records for each virtual card instance, or only aggregate skill state? Persistence allows review of past attempts but inflates storage.

2. **Mixing Weights**: How do procedural sources interact with ELO-based content? Should procedural content have its own weight in the mixer?

3. **Course Author Configuration**: Can course authors configure which procedural sources are available? Can they set initial levels or bounds?

4. **Skill Transferability**: If a skill is trained in one course, does it transfer to another? (e.g., typing speed across typing and chess courses)

5. **Protocol Selection**: Should adaptation protocol be per-skill-type or configurable per-user/per-course?

---

## File Reference

| New File | Purpose |
|----------|---------|
| `core/types/skillState.ts` | SkillState type, AdaptationProtocol interface |
| `core/interfaces/proceduralContentSource.ts` | ProceduralContentSource interface |
| `core/procedural/BaseProceduralSource.ts` | Abstract base class |
| `core/procedural/protocols/ericsson.ts` | Ericsson protocol implementation |
| `core/procedural/protocols/gradient.ts` | Gradient protocol implementation |
| `core/procedural/protocols/staircase.ts` | Staircase protocol implementation |
| `core/procedural/DigitSpanProceduralSource.ts` | Reference implementation |
| `core/procedural/TypingSpeedProceduralSource.ts` | Reference implementation |

| Modified File | Changes |
|---------------|---------|
| `study/services/CardHydrationService.ts` | Virtual card handling |
| `study/SessionController.ts` | Procedural outcome routing |
| `express/src/routes/skills.ts` | Skill progression API |