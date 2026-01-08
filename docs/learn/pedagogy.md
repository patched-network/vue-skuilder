# Pedagogy System

Vue-Skuilder combines **Spaced Repetition System (SRS)** scheduling with **multi-dimensional ELO rating** and **evolutionary orchestration** to create an adaptive learning system that continuously improves.

## The Vision: Beyond Naive SRS

Traditional SRS systems randomly present new content and schedule reviews based on user performance. Vue-Skuilder improves on this with a **dual-dynamic** approach:

- **User-Dynamic**: Learner skill ratings adjust over time, ensuring content difficulty matches current ability
- **System-Dynamic**: Card difficulty ratings refine with use across all learners, improving course calibration
- **Skill-Aware**: Multi-dimensional tracking enables fine-grained difficulty targeting per topic
- **Self-Improving**: Navigation strategies carry learnable weights that automatically tune toward optimal effectiveness

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

### Pipeline Architecture

Strategies are organized into a **Pipeline** with two types of components:

- **Generators** produce candidate cards with initial scores (ELO matching, SRS scheduling, fixed sequences)
- **Filters** transform scores from upstream (prerequisite gating, interference penalties, priority boosts)

```
Pipeline = Generator + Filters
         = Composite(ELO, SRS) → Hierarchy → Interference → Priority
```

Each card carries a **provenance trail** showing how it was scored:

```typescript
provenance: [
  { strategy: 'elo', action: 'generated', score: 0.85, reason: 'ELO distance 75' },
  { strategy: 'hierarchy', action: 'passed', score: 0.85, reason: 'Prerequisites met' },
  { strategy: 'interference', action: 'penalized', score: 0.72, reason: 'Tag cooldown' }
]
```

### Built-In Strategies

Vue-Skuilder ships with several configurable strategies:

#### Adaptive Difficulty (ELO Generator)

Matches card difficulty to user skill level. New cards are selected from a window centered on the user's current ELO rating, ensuring appropriate challenge without overwhelming or boring the learner.

#### Spaced Repetition (SRS Generator)

Surfaces review cards based on scheduling algorithms. Cards are scored by overdueness and interval recency.

#### Prerequisite Gating (Hierarchy Filter)

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

#### Interference Avoidance (Filter)

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

#### Priority Ordering (Filter)

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

## Evolutionary Orchestration

Beyond static configuration, strategies can carry **learnable weights** that automatically tune toward optimal effectiveness based on observed learning outcomes.

### How It Works

1. **Learnable Weights**: Each strategy carries a weight (peak value), confidence (exploration width), and sample count:

```typescript
interface LearnableWeight {
  weight: number;       // Peak value, 1.0 = neutral
  confidence: number;   // 0-1, controls exploration
  sampleSize: number;   // Total observations
}
```

2. **Deviation Distribution**: Each user experiences a stable deviation from the peak weight, determined by hash. Low confidence means wide exploration; high confidence means convergence toward the optimal peak.

3. **Outcome Recording**: Learning outcomes (accuracy in target zone, ELO progression) are recorded per user per period.

4. **Gradient Learning**: The system correlates deviation with outcomes across users:
   - Users with +deviation getting better outcomes → increase peak weight
   - Users with +deviation getting worse outcomes → decrease peak weight
   - Consistent observations → increase confidence

5. **Automatic Updates**: Periodically, strategy weights adjust based on gradient, and confidence updates based on observation consistency.

### Lifecycle

```
New strategy:    Low confidence → wide spread → noisy gradient → big adjustments
Learning:        Gradient visible → peak drifts → confidence grows → spread shrinks
Converged:       High confidence → minimum spread → flat gradient → stable
Disturbed:       Gradient reappears → peak drifts → adapts to new optimal
```

### Static Strategies

Foundational strategies (like core prerequisites) can be marked `staticWeight: true` to exclude them from learning.

### Observability

An admin dashboard provides visibility into:
- Current weights and confidence levels for all strategies
- Weight trajectory over time
- Gradient direction and strength
- Deviation vs outcome scatter plots

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
| **Orchestration** | Tune strategy effectiveness over time |

Each layer can be customized independently.

### Data-Driven Refinement

- **User ELO** personalizes difficulty over time
- **Card ELO** calibrates content based on population performance
- **Per-tag tracking** enables skill-tree visualizations
- **Strategy weights** learn optimal configurations automatically
- **Provenance trails** enable debugging and transparency

### Good Defaults, Clear Paths Forward

Simple courses work out-of-the-box with adaptive difficulty. Advanced courses can layer strategies (prerequisites + interference avoidance + priority ordering) via configuration. Researchers can implement novel algorithms by extending the navigator interface.

## Roadmap

### Available Now

- ✅ Dual-dynamic ELO (user + card ratings adjust together)
- ✅ SRS scheduling with performance-modulated intervals
- ✅ Pipeline architecture (generators + filters)
- ✅ Configurable strategies: Hierarchy, Interference, Priority
- ✅ Visual strategy authoring UI
- ✅ Per-tag ELO tracking
- ✅ Evolutionary orchestration (learnable weights, deviation distribution, gradient learning)
- ✅ Observability API and admin dashboard
- ✅ Provenance tracking for transparency

### Future Vision

- **Parameterizable strategies**: Template-based rules that generalize across courses
- **Self-healing content**: Automatic barrier detection, author alerting, intervention measurement
- **Trigger-response generators**: Event-driven strategies (frustration intervention, plateau breakers)
- **Cross-course strategy sharing**: Effective strategies propagate to other courses
- **Cohort-aware calibration**: Population data improves cold-start behavior

---

## Summary

Vue-Skuilder's pedagogy system provides:

**Out-of-the-box**: An adaptive learning system where both users and content evolve together. Learners encounter appropriately challenging material; courses become better calibrated through use. Strategies automatically tune toward effectiveness.

**For course authors**: Configurable strategies (prerequisites, interference avoidance, priorities) accessible through visual UI — no code required. Strategy weights learn optimal values automatically.

**For researchers and developers**: Clean extension points via the `ContentNavigator` interface. Multi-dimensional performance infrastructure ready to power sophisticated adaptive tutoring. Full provenance tracking for transparency.

The philosophy: *Good defaults with clear paths to sophisticated customization.*