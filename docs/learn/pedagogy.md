# Pedagogy System

Vue-Skuilder combines **Spaced Repetition System (SRS)** scheduling with **multi-dimensional ELO rating** to create an adaptive learning system that is both user-dynamic and system-dynamic.

## The Vision: Beyond Naive SRS

Traditional SRS systems randomly present new content and schedule reviews based on user performance. Vue-Skuilder improves on this with a **dual-dynamic** approach:

- **User-Dynamic**: Learner skill ratings adjust over time, ensuring content difficulty matches current ability
- **System-Dynamic**: Card difficulty ratings refine with use across all learners, improving course calibration
- **Skill-Aware**: Multi-dimensional tracking enables fine-grained difficulty targeting per topic

This means users encounter appropriately challenging content while the course itself becomes better calibrated through collective interaction.

## Core Concepts

### Multi-Dimensional Skill Tracking

Performance is tracked across multiple dimensions using an ELO-style rating system:

```typescript
type CourseElo = {
  global: EloRank;      // Overall skill/difficulty rating
  tags: {               // Per-topic performance tracking
    [tagID: string]: EloRank;
  };
};

type EloRank = {
  score: number;        // Rating value (centered around 1000)
  count: number;        // Number of interactions (confidence measure)
};
```

Both **users** and **cards** carry these ratings. When a user interacts with a card:

1. The card's `Question` evaluates the response, producing an `Evaluation`
2. Both user and card ELO ratings adjust based on the outcome
3. Updates occur for global ELO *and* for each tag on the card

**Example**: A chess puzzle tagged `["forks", "pins", "middlegame"]` updates the user's global rating plus three topic-specific ratings. Over time, the system learns that this user is strong on forks but weak on pins.

### The Evaluation Contract

The bridge between card interaction and the pedagogy system is the `Evaluation` type:

```typescript
interface Evaluation {
  isCorrect: boolean;     // Binary: did the user succeed?
  performance: number;    // Continuous [0, 1]: how well did they perform?
}
```

- **`isCorrect`** drives SRS scheduling — success extends the review interval, failure resets it
- **`performance`** drives ELO adjustment — accounts for partial credit, time penalties, etc.

This separation allows a card to be "correct" for scheduling purposes while still recording nuanced performance data.

### Spaced Repetition Scheduling

The SRS component determines *when* cards should resurface for review:

- **Successful reviews** extend the interval before the next review
- **Failed reviews** reset the interval — the card re-enters immediate practice
- **Interval growth** is modulated by historical performance (streaks, lapses, best prior interval)

The system maintains a buffer of cards that are *eligible* for review but not yet *overdue*, enabling graceful handling of variations in study routine.

### Session Management

A study session balances three pools of content:

| Pool | Source | Priority |
|------|--------|----------|
| **New Cards** | Never-seen content matched to user skill level | Introduces fresh material |
| **Review Cards** | Due or nearly-due scheduled reviews | Maintains retention |
| **Failed Cards** | Cards failed during this session | Must be cleared before session ends |

The session dynamically adjusts the mix based on time remaining:
- Early in a session: lean toward new content
- As time runs short: prioritize clearing reviews
- Final phase: focus exclusively on failed cards (cleanup)

**Guarantee**: Failed cards must be successfully completed before the session can end. This ensures the user doesn't leave with unresolved confusion.

## Content Selection Strategies

The system uses **Navigation Strategies** to determine which cards surface and in what order. The core abstraction:

```typescript
interface StudyContentSource {
  getNewCards(n?: number): Promise<StudySessionNewItem[]>;
  getPendingReviews(): Promise<StudySessionReviewItem[]>;
}
```

Strategies control:
- **Which** cards are candidates (filtering by tags, prerequisites, metadata)
- **How** candidates are ordered (by difficulty, priority, recency)
- **When** cards become available (prerequisite gates, interference windows)

### Built-In Strategies

Vue-Skuilder ships with several configurable strategies:

#### Adaptive Difficulty (Default)

Matches card difficulty to user skill level. New cards are selected from a window centered on the user's current ELO rating, ensuring appropriate challenge without overwhelming or boring the learner.

#### Prerequisite Gating (Hierarchy)

Locks advanced content until foundational concepts are mastered:

```typescript
interface HierarchyConfig {
  prerequisites: {
    [tagId: string]: Array<{
      tag: string;
      masteryThreshold?: {
        minElo?: number;
        minCount?: number;
      };
    }>;
  };
}
```

**Example**: Cards tagged `"long-division"` only surface after the user demonstrates mastery of `"multiplication-facts"` (e.g., ELO ≥ 1050, count ≥ 20).

#### Interference Avoidance

Prevents confusable concepts from appearing too close together:

```typescript
interface InterferenceConfig {
  interferenceSets: Array<{
    tags: string[];           // Mutually interfering concepts
    decay?: number;           // How quickly the penalty fades
  }>;
  maturityThreshold?: {       // When concepts are "mature enough" to intermix
    minCount?: number;
    minElo?: number;
  };
}
```

**Example**: For early readers, `"letter-b"` and `"letter-d"` cards are spaced apart until the learner has sufficient practice with each individually.

#### Priority Ordering

Boosts utility of high-value content:

```typescript
interface RelativePriorityConfig {
  tagPriorities: { [tagId: string]: number };  // 0-1 priority scores
  combineMode?: 'max' | 'average' | 'min';
}
```

**Example**: High-frequency vocabulary words get priority over rare words in a language course.

### Strategy Authoring

All built-in strategies can be configured through a **visual editor** in the course authoring UI — no code required. Each strategy type has a dedicated form with:

- Tag selectors populated from the course
- Threshold inputs with sensible defaults
- Real-time validation

For advanced use cases, strategies can also be defined via JSON configuration.

## Extension Points

The pedagogy system is designed for experimentation and customization.

### Custom Strategies

To implement novel pedagogical approaches, extend the `ContentNavigator` base class:

```typescript
abstract class ContentNavigator implements StudyContentSource {
  abstract getNewCards(n?: number): Promise<StudySessionNewItem[]>;
  abstract getPendingReviews(): Promise<StudySessionReviewItem[]>;
}
```

Your implementation controls card selection logic while the session controller handles queue management, timing, and user interaction.

**Potential applications**:
- Bayesian Knowledge Tracing for mastery probability modeling
- Item Response Theory for sophisticated difficulty calibration  
- Concept dependency graphs with complex prerequisite logic
- Adaptive pacing based on engagement signals

### Multi-Dimensional Performance

The `Performance` type supports nested skill assessment:

```typescript
type Performance = number | { [dimension: string]: Performance };
```

This enables cards to report rich performance data:

```typescript
{
  isCorrect: true,
  performance: {
    accuracy: 0.9,
    speed: 0.7,
    technique: {
      fingerPosition: 0.8,
      timing: 0.6
    }
  }
}
```

The infrastructure for multi-dimensional tracking exists; navigators that leverage it for card selection are a natural next step.

## Architectural Benefits

### Separation of Concerns

| Component | Responsibility |
|-----------|----------------|
| **Questions** | Define what constitutes mastery for a card type |
| **SRS** | Determine when to schedule reviews |
| **Navigators** | Select which cards to surface |
| **SessionController** | Orchestrate queues, timing, user flow |

Each layer can be customized independently.

### Data-Driven Refinement

- **User ELO** personalizes difficulty over time
- **Card ELO** calibrates content based on population performance
- **Per-tag tracking** enables future skill-tree visualizations
- **Strategy configurations** can be A/B tested across user cohorts

### Good Defaults, Clear Paths Forward

Simple courses work out-of-the-box with adaptive difficulty. Advanced courses can layer strategies (prerequisites + interference avoidance + priority ordering) via configuration. Researchers can implement novel algorithms by extending the navigator interface.

## Roadmap

### Available Now
- Dual-dynamic ELO (user + card ratings adjust together)
- SRS scheduling with performance-modulated intervals
- Configurable strategies: Hierarchy, Interference, Priority
- Visual strategy authoring UI
- Per-tag ELO tracking (data collection)

### In Development
- **Active per-tag targeting**: Surface cards addressing specific weak skills
- **Pipeline composition**: Chain multiple strategies (e.g., Priority → Interference → Hierarchy → ELO)
- **Strategy state persistence**: Allow strategies to remember context across sessions

### Future Vision
- **Evolutionary orchestration**: Multiple strategy configurations compete; effective approaches propagate
- **Barrier detection**: Automatically identify where learners get stuck
- **Self-healing content**: Surface insights to authors, incentivize remediation
- **Cohort-aware calibration**: Population-informed initial intervals and difficulty estimates

---

## Summary

Vue-Skuilder's pedagogy system provides:

**Out-of-the-box**: An adaptive learning system where both users and content evolve together. Learners encounter appropriately challenging material; courses become better calibrated through use.

**For course authors**: Configurable strategies (prerequisites, interference avoidance, priorities) accessible through visual UI — no code required.

**For researchers and developers**: Clean extension points via the `ContentNavigator` interface. Multi-dimensional performance infrastructure ready to power sophisticated adaptive tutoring.

The philosophy: *Good defaults with clear paths to sophisticated customization.*