# Assessment: Procedural Content Generation Architecture

**Date**: 2026-01-13  
**Context**: Exploring paths toward dynamically-tuned, procedurally-generated content

---

## The Ericsson Challenge

Anders Ericsson's digit span experiment demonstrates a simple but powerful protocol:

1. Present a sequence of N digits
2. User attempts recall
3. If correct: N → N+1  
4. If incorrect: N → N-2

This keeps learners at the *edge of their proficiency* with minimal configuration. The protocol is:
- **Adaptive**: Difficulty adjusts in real-time based on performance
- **Stateful**: Requires tracking current N across presentations
- **Procedural**: Content (the digit sequence) is generated, not retrieved

### Current Framework Gaps

The existing architecture doesn't straightforwardly support this because:

1. **Cards are DB artifacts**: Content comes from `DisplayableData` documents with pre-defined `ViewData`
2. **Generators select, not create**: `ELONavigator` and `SRSNavigator` query existing cards; they don't synthesize content
3. **State is per-card, not per-skill**: The SRS interval lives on the card record, but there's no concept of "current difficulty level for this skill"
4. **Difficulty is static**: A card's ELO is fixed at creation; it doesn't adapt to user performance on that card type

---

## Current Architecture Summary

### Content Flow (Existing)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CONTENT CREATION (Authoring)                   │
│  Author → DataShape → DisplayableData → Card                        │
│           or seedData auto-registration                             │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CONTENT SELECTION (Runtime)                    │
│  Generator (ELO/SRS) → Pipeline → Filters → Scored Cards           │
│                                                                     │
│  All generators SELECT from existing cards                          │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CONTENT PRESENTATION                           │
│  SessionController → CardHydrationService → Question instance       │
│                                                                     │
│  Question constructed from ViewData[], presents to user             │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Interfaces

| Interface | Role |
|-----------|------|
| `CardGenerator` | Produces `WeightedCard[]` by querying DB |
| `Question` | Takes `ViewData[]`, presents to user, evaluates answers |
| `SessionController` | Orchestrates study session, maintains queues |
| `StrategyState` | User-scoped, course-scoped key-value storage |

### Existing "Procedural" Content

The `ForkFinder` chess question is instructive:
- `acceptsUserData = false` (closed set)
- Constructor receives minimal seed data (`{ Piece: 'n' }`)
- `generatePositions()` creates board states algorithmically
- Difficulty varies by random generation, not adaptive tuning

This is **pseudo-procedural**: the Question class generates content, but:
- No feedback loop from performance to difficulty
- No persistent state across sessions
- No skill-level tracking for this content type

---

## Design Options

### Option A: "Procedural Generator" — New Generator Type

Introduce a new `CardGenerator` that synthesizes content rather than querying it.

```typescript
interface ProceduralGenerator extends CardGenerator {
  name: string;
  
  // Instead of querying cards, generates content specs
  getWeightedCards(limit: number, context: GeneratorContext): Promise<WeightedCard[]>;
  
  // Maps generated spec to Question constructor data
  hydrateContent(cardId: string, context: GeneratorContext): Promise<ViewData[]>;
}
```

**Flow:**
1. ProceduralGenerator returns "virtual cards" with synthetic IDs
2. CardHydrationService recognizes virtual cards, calls generator's `hydrateContent()`
3. Question instantiated with generated ViewData

**State Management:**
- Use `StrategyState` with key like `procedural::digit-span`
- Store `{ currentN: 7, consecutiveCorrect: 0, consecutiveIncorrect: 0 }`
- Update state after each response

**Pros:**
- Fits into existing Pipeline architecture
- Provenance tracking works (we can attribute to "procedural::digit-span")
- Orchestration can learn weights for procedural vs DB content

**Cons:**
- CardHydrationService needs to understand "virtual" cards
- No card history (what does "review" mean for procedural content?)
- Requires new interface contract for content synthesis

---

### Option B: "Adaptive Question" — Self-Modifying Question Class

Extend `Question` to support difficulty adaptation at the class level.

```typescript
abstract class AdaptiveQuestion extends Question {
  // Per-user-per-course state (injected)
  protected abstract getAdaptiveState(): Promise<AdaptiveState>;
  protected abstract putAdaptiveState(state: AdaptiveState): Promise<void>;
  
  // Difficulty parameters derived from state
  protected abstract computeDifficultyParams(): DifficultyParams;
  
  // After evaluation, adjust state
  protected abstract adjustDifficulty(evaluation: Evaluation): AdaptiveState;
}
```

**Implementation for DigitSpan:**
```typescript
class DigitSpanQuestion extends AdaptiveQuestion {
  static dataShapes = [{ name: 'DIGIT_SPAN', fields: [] }]; // Empty! Self-generating
  static acceptsUserData = false;
  static seedData = [{}]; // Single empty seed to create one "card"
  
  private sequenceLength: number;
  
  constructor(data: ViewData[], adaptiveState: AdaptiveState) {
    super(data);
    this.sequenceLength = adaptiveState.currentN || 4;
    this.sequence = this.generateSequence(this.sequenceLength);
  }
  
  adjustDifficulty(evaluation: Evaluation): AdaptiveState {
    if (evaluation.isCorrect) {
      return { currentN: this.sequenceLength + 1 };
    } else {
      return { currentN: Math.max(3, this.sequenceLength - 2) };
    }
  }
}
```

**Pros:**
- Minimal infrastructure change
- Questions own their adaptation logic
- Single card in DB, infinite content variation

**Cons:**
- How does adaptive state get injected into Question constructor?
- Question classes shouldn't have DB access (violates layering)
- Doesn't address procedural *selection* (what if we want to mix digit-span with other content?)

---

### Option C: "Skill Dimension Navigator" — Per-Skill Difficulty Tracking

Introduce a concept of "skill dimensions" orthogonal to cards.

```typescript
interface SkillDimension {
  id: string;                    // e.g., 'digit-span', 'typing-speed'
  currentLevel: number;          // Continuous difficulty parameter
  confidenceInterval: [number, number]; // Uncertainty bounds
}

interface SkillDimensionNavigator extends CardGenerator {
  skillId: string;
  
  // Generate content at current skill level
  generateAtLevel(level: number): ViewData[];
  
  // Update skill level based on outcome
  updateLevel(outcome: Evaluation): void;
}
```

**Flow:**
1. SkillDimensionNavigator reads user's current level for this skill from StrategyState
2. Generates "virtual card" targeting that level
3. On response, updates skill level (stored in StrategyState)
4. Next presentation uses updated level

**Pros:**
- Clean separation: navigation knows about skills, questions know about content
- Can mix skill-based content with card-based content in same session
- Skill levels are observable, debuggable, inspectable

**Cons:**
- New abstraction layer (SkillDimension) to maintain
- Need to define how skill levels map to content generation
- Orchestration becomes more complex (weights per skill, not just per strategy)

---

### Option D: "Continuous DataShape" — Parameterized Content at Selection Time

Define DataShapes with *ranges* rather than fixed values.

```typescript
interface ContinuousField {
  name: string;
  type: FieldType.NUMBER;
  continuous: true;
  min: number;
  max: number;
  default: number;
}

// At selection time, generator chooses value
const dataShape: DataShape = {
  name: 'FALLING_LETTERS',
  fields: [
    { name: 'speed', type: FieldType.NUMBER, continuous: true, min: 1, max: 10, default: 2 },
    { name: 'spawnInterval', type: FieldType.NUMBER, continuous: true, min: 0.1, max: 2, default: 1 }
  ]
};
```

**Generator Implementation:**
```typescript
class AdaptiveSpeedGenerator implements CardGenerator {
  async getWeightedCards(limit: number, context: GeneratorContext): Promise<WeightedCard[]> {
    const userSpeed = await this.getUserSkillLevel('typing-speed');
    
    return [{
      cardId: 'VIRTUAL::falling-letters::' + uuid(),
      courseId: context.course.getCourseID(),
      score: 1.0,
      // Params stored on card for hydration
      generatedParams: { speed: userSpeed, spawnInterval: 1 / userSpeed },
      provenance: [...]
    }];
  }
}
```

**Pros:**
- DataShapes already exist; this extends them naturally
- Existing Questions can become adaptive by marking fields continuous
- No new infrastructure for "virtual cards" — they're just cards with generated params

**Cons:**
- DisplayableData format would need to support "template" cards
- Need convention for what generates the params (DataShape? Generator? Hydration?)
- Mixes concerns: DataShape describes *shape*, not *selection strategy*

---

### Option E: "Hybrid" — ProceduralContentSource + SkillState

Combine best elements: a new content source type that integrates skill tracking.

```typescript
interface ProceduralContentSource extends StudyContentSource {
  skillId: string;
  
  // Get weighted virtual cards based on current skill state
  getWeightedCards(limit: number): Promise<ProceduralWeightedCard[]>;
  
  // Called after response to update skill state
  recordOutcome(cardId: string, evaluation: Evaluation): Promise<void>;
}

interface ProceduralWeightedCard extends WeightedCard {
  isVirtual: true;
  skillId: string;
  difficultyParams: Record<string, number>;
}
```

**Integration Points:**
1. `SessionController.sources` can include `ProceduralContentSource` instances
2. `CardHydrationService.hydrateCard()` checks for `isVirtual` flag
3. For virtual cards, calls back to source for content generation
4. `SessionController.submitResponse()` routes to source's `recordOutcome()`

**SkillState Storage:**
```typescript
interface SkillState {
  level: number;
  history: Array<{ timestamp: string; level: number; evaluation: Evaluation }>;
  // For Ericsson protocol:
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
}
```

Stored via `userDB.putStrategyState(courseId, `skill::${skillId}`, skillState)`.

**Pros:**
- Clean extension of existing architecture
- Skill state is first-class, observable, debuggable
- Can coexist with card-based content in same session
- `recordOutcome` callback gives procedural source control over adaptation

**Cons:**
- SessionController needs awareness of procedural sources
- CardHydrationService needs extension for virtual card hydration
- More complex than pure-Question solution (Option B)

---

## Comparative Analysis

| Criterion | A: Procedural Generator | B: Adaptive Question | C: Skill Navigator | D: Continuous DataShape | E: Hybrid Source |
|-----------|------------------------|---------------------|-------------------|------------------------|------------------|
| **Fits existing architecture** | ★★★☆☆ | ★★★★☆ | ★★☆☆☆ | ★★★☆☆ | ★★★★☆ |
| **Clean separation of concerns** | ★★★☆☆ | ★★☆☆☆ | ★★★★☆ | ★★☆☆☆ | ★★★★★ |
| **Supports Ericsson protocol** | ★★★★★ | ★★★★★ | ★★★★★ | ★★☆☆☆ | ★★★★★ |
| **Works with FallingLetters** | ★★★★☆ | ★★★☆☆ | ★★★★☆ | ★★★★★ | ★★★★★ |
| **Minimal infrastructure change** | ★★☆☆☆ | ★★★★☆ | ★★☆☆☆ | ★★★☆☆ | ★★★☆☆ |
| **Observable/debuggable** | ★★★★☆ | ★★☆☆☆ | ★★★★★ | ★★★☆☆ | ★★★★★ |
| **Mixes well with DB content** | ★★★★☆ | ★★★★☆ | ★★★☆☆ | ★★★★☆ | ★★★★★ |

---

## The FallingLetters Scenario

`FallingLettersQuestion` has continuously adjustable parameters:
- `gameLength` (30 seconds)
- `initialSpeed` (2)
- `acceleration` (0.1)
- `spawnInterval` (1 second)

Currently, these are fixed per card. To make them adaptive:

**Option B approach**: Create `AdaptiveFallingLettersQuestion` that:
- Reads user's typing skill level
- Sets `initialSpeed = f(skillLevel)`
- After game, updates skill level based on `percentage` score

**Option E approach**: Create `TypingSpeedProceduralSource` that:
- Maintains `skillState.typingSpeed` in StrategyState
- Generates virtual cards with speed params: `{ speed: skillState.typingSpeed * 1.05 }` (slight challenge)
- On outcome, adjusts skillState: `if (percentage > 0.9) speed += 0.1`

The Option E approach is preferable because:
1. Speed adaptation lives in navigation, not in Question class
2. Can mix falling-letters with single-letter drills in same session
3. Observable skill progression separate from individual card records

---

## Recommendation

**Primary: Option E (Hybrid ProceduralContentSource + SkillState)**

This option:
- Extends `StudyContentSource` interface minimally
- Keeps Questions pure (they receive ViewData, don't manage state)
- Makes skill progression first-class and observable
- Integrates with existing SessionController and SourceMixer
- Supports both Ericsson-style protocols and continuous difficulty tuning

**Implementation Phases:**

1. **Phase 1: SkillState Infrastructure**
   - Define `SkillState` type and storage conventions
   - Add skill state read/write to `StrategyState` patterns
   - No new generators yet — just infrastructure

2. **Phase 2: ProceduralContentSource Interface**
   - Define `ProceduralContentSource` extending `StudyContentSource`
   - Add virtual card detection in `CardHydrationService`
   - Add outcome routing in `SessionController`

3. **Phase 3: Reference Implementation**
   - Implement `DigitSpanProceduralSource` (Ericsson protocol)
   - Implement `TypingSpeedProceduralSource` (continuous tuning for FallingLetters)
   - Validate mixing with card-based content

4. **Phase 4: Orchestration Integration**
   - Extend orchestration to track per-skill outcomes
   - Consider skill-level weights in evolutionary tuning
   - Dashboard for skill progression visualization

---

## Alternative Consideration: Option B for Simplicity

If implementation scope is a concern, **Option B (Adaptive Question)** is viable as a stepping stone:

- Create `AdaptiveQuestion` base class
- Inject `SkillStateAccessor` into Question constructor (via CardHydrationService)
- Questions can read/update skill state directly
- Less infrastructure, faster to prototype

This can later evolve into Option E by extracting the adaptation logic into a source.

---

## Questions for Clarification

1. **Mixed Sessions**: Should procedural content mix with DB content in the same session, or be separate "modes"?

2. **Skill Granularity**: Is skill tracking per-question-type sufficient, or do we need finer granularity (e.g., per-tag, per-concept)?

3. **History/Review Semantics**: What does "review" mean for procedural content? Is there a persistent record per generated instance, or only aggregate skill state?

4. **UI Implications**: Should the UI indicate when content is procedurally generated vs. curated?

5. **Authoring Implications**: Should course authors be able to configure procedural difficulty curves, or is this purely user-adaptive?

---

## Next Steps

Pending selection of approach:
- Draft detailed technical specification
- Identify touch points in existing codebase
- Size implementation effort
- Create implementation plan (`a.2.plan.md`)