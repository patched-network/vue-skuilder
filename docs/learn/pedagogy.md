# Pedagogy System

Vue-Skuilder combines **Spaced Repetition System (SRS)** scheduling with **multi-dimensional ELO rating** to create an adaptive learning system that is both user-dynamic and system-dynamic.

## Overview: Beyond Naive SRS

Traditional SRS systems randomly present new content and schedule reviews based on user performance. Vue-Skuilder improves on this by:

- **User-Dynamic**: User ELO scores adjust difficulty of content presented
- **System-Dynamic**: Card ELO ratings refine with use, improving course quality over time
- **Skill-Aware**: Multi-dimensional ELO tracking enables future fine-grained difficulty targeting

This dual-dynamic system ensures users encounter appropriately challenging content while the course itself becomes better calibrated through collective interaction.

## Core Components

### 1. Multi-Dimensional ELO System

ELO ratings in Vue-Skuilder track performance across multiple dimensions:

```typescript
type CourseElo = {
  global: EloRank;      // Overall difficulty/skill rating
  tags: {               // Per-tag performance tracking
    [tagID: string]: EloRank;
  };
};

type EloRank = {
  score: number;        // ELO rating (typically ~1000)
  count: number;        // Number of interactions
};
```

#### How ELO Updates Work

When a user interacts with a card:

1. **Performance Calculation**: The `Question.evaluate()` method returns an `Evaluation` with:
   - `isCorrect`: Binary pass/fail for SRS scheduling
   - `performance`: Continuous score [0, 1] for ELO adjustment (includes time penalties)

2. **Dual ELO Update**: Both user and card ELOs adjust via standard ELO formula:
   ```typescript
   // Expected outcome based on rating difference
   expected = 1 / (1 + 10^((cardElo - userElo) / 400))

   // Update ratings
   newUserElo = userElo + K * (actual - expected)
   newCardElo = cardElo + K * (expected - actual)
   ```

3. **Multi-Dimensional Tracking**: Updates occur for:
   - **Global ELO**: Overall user skill vs. card difficulty
   - **Per-Tag ELO**: User skill vs. card difficulty *for each tag on the card*

Example: A chess puzzle tagged with `["forks", "pins", "middlegame"]` updates global ELO plus three tag-specific ELOs.

#### Current vs. Future Use

**Currently**: Per-tag ELOs are tracked but not yet used for card selection. The `ELONavigator` selects cards based on global ELO only.

**Future**: Tag-specific ELO will enable targeted practice:
- User weak on "forks" tactic → surface easier fork puzzles
- User strong on "scales" but weak on "arpeggios" → adaptive music theory practice
- Fine-grained skill trees with differential difficulty targeting

### 2. Spaced Repetition System (SRS)

The SRS component schedules card reviews based on user performance history.

#### Interval Calculation

When a user correctly answers a card (packages/db/src/study/SpacedRepetition.ts:20):

```typescript
// Base interval calculation
interval = lastSuccessfulInterval * (0.75 + performance)

// Weighted by historical performance
finalInterval = (lapses * currentInterval + streak * bestInterval)
                / (lapses + streak)
```

**Key factors**:
- `performance`: Normalized score [0, 1] from `Question.evaluate()`
- `lastSuccessfulInterval`: Time since last first-attempt success
- `lapses`: Number of failed attempts (historical)
- `streak`: Current consecutive successes
- `bestInterval`: Longest successful interval ever achieved

**Initial interval**: 3 days for new cards (hardcoded, future: data-driven based on population performance)

#### Review Scheduling

Failed cards:
- `isCorrect: false` → Interval resets to 0
- Card re-enters session's "failed queue" for immediate retry

Successful cards:
- SRS calculates next review time
- Review scheduled in user's database
- Card surfaces automatically when due

### 3. Study Session Content Selection

The `SessionController` manages three queues with dynamic probability distribution:

#### Queues

1. **New Cards** (`newQ`): Never-seen content from `ContentNavigator.getNewCards()`
2. **Review Cards** (`reviewQ`): Due reviews from `ContentNavigator.getPendingReviews()`
3. **Failed Cards** (`failedQ`): Cards failed during this session

#### Selection Algorithm

The system dynamically adjusts queue probabilities based on time remaining:

```typescript
// Time-aware probability boundaries
let newBound = 0.1;      // Probability of drawing from newQ
let reviewBound = 0.75;  // Probability of drawing from reviewQ or newQ
                          // (remainder goes to failedQ)

const cleanupTime = estimateFailedCardTime();
const reviewTime = estimateReviewTime();
const availableTime = timeRemaining - (cleanupTime + reviewTime);

if (availableTime > 20s) {
  // Plenty of time → lean toward new content
  newBound = 0.5;
  reviewBound = 0.9;
} else if (timeRemaining - cleanupTime > 20s) {
  // Time for reviews → prioritize reviews
  newBound = 0.05;
  reviewBound = 0.9;
} else {
  // Little time → focus on failed cards
  newBound = 0.01;
  reviewBound = 0.1;
}
```

**Guarantees**:
- Session starts by introducing at least one new card from each content source
- When time expires, only failed cards are presented (cleanup phase)
- Failed cards *must* be cleared before session ends

#### ELO-Based Card Selection

The default `ELONavigator` uses ELO ratings to select appropriate content:

**For New Cards** (packages/db/src/core/navigators/elo.ts:59):
```typescript
getNewCards(limit: number): Promise<StudySessionNewItem[]> {
  // 1. Get user's current ELO for this course
  const userElo = await getCourseRegistration(courseId);

  // 2. Get cards centered at user's ELO rating
  return await course.getCardsCenteredAtELO({
    limit: limit,
    elo: userElo  // Match card difficulty to user skill
  },
  (card) => !card.alreadyActive // Filter out active cards
  );
}
```

**For Reviews**:
```typescript
getPendingReviews(): Promise<ReviewItem[]> {
  // 1. Get all due reviews from SRS schedule
  const reviews = await user.getPendingReviews(courseID);

  // 2. Sort by card difficulty (easiest first)
  reviews.sort((a, b) => a.elo - b.elo);

  return reviews;
}
```

This approach ensures:
- New cards match the user's current skill level
- Reviews start with easier cards, building confidence
- User and card ELOs co-evolve, improving matching over time

## Extension Points: Custom Pedagogy

The pedagogy system is designed for experimentation and customization via the `ContentNavigator` abstraction.

### The ContentNavigator Interface

```typescript
abstract class ContentNavigator implements StudyContentSource {
  abstract getPendingReviews(): Promise<StudySessionReviewItem[]>;
  abstract getNewCards(n?: number): Promise<StudySessionNewItem[]>;
}
```

Custom navigators control:
- **Which** cards surface (filtering by tags, DataShapes, metadata)
- **When** cards surface (scheduling strategies beyond SRS)
- **How** cards are ordered (difficulty progression, concept dependencies)

### Creating a Custom Navigator

1. **Define Strategy Metadata** in course database:
   ```typescript
   {
     docType: DocType.NAVIGATION_STRATEGY,
     name: "ConceptDependency",
     implementingClass: "conceptDependency",  // filename to import
     serializedData: JSON.stringify({
       rootConcepts: ["addition", "subtraction"],
       dependencyGraph: { /* ... */ }
     })
   }
   ```

2. **Implement Navigator Class** (packages/db/src/core/navigators/):
   ```typescript
   export default class ConceptDependencyNavigator extends ContentNavigator {
     constructor(user, course, strategyData) {
       super();
       this.dependencies = JSON.parse(strategyData.serializedData);
     }

     async getNewCards(limit: number) {
       // Custom logic: only surface cards for concepts
       // whose prerequisites have been mastered
       const masteredConcepts = await this.getMasteredConcepts();
       const availableConcepts = this.getUnlockedConcepts(masteredConcepts);

       return await this.course.getCardsByTags(availableConcepts, limit);
     }

     async getPendingReviews() {
       // Could prioritize reviews of prerequisite concepts
       // when user struggles with dependent concepts
       return await this.user.getPendingReviews(this.course.getCourseID());
     }
   }
   ```

3. **Register Navigator** with course:
   ```typescript
   course.setNavigationStrategy("NAVIGATION_STRATEGY-concept-deps");
   ```

The system dynamically imports and instantiates the navigator at session start.

### Navigator Use Cases

**Global Strategies** (course-wide pedagogical approaches):
- **Bayesian Knowledge Tracing**: Model concept mastery probabilities, surface cards targeting uncertainty
- **Item Response Theory**: Sophisticated difficulty calibration beyond ELO
- **Hypergraph Dependencies**: Tag-based concept prerequisite graphs

**Targeted Interventions** (responding to specific failure patterns):
- **Error Pattern Detection**: If user repeatedly fails "fraction multiplication" → surface prerequisite "fraction concepts"
- **Mastery Thresholds**: Require N successful reviews before unlocking advanced content
- **Interleaving Strategies**: Force spacing between related concepts to improve retention

### Future Directions

**Active Per-Tag ELO** (packages/common/src/elo.ts:19):
Currently, tag-specific ELOs are tracked but unused. Future navigators will:
- Surface cards targeting specific weak skills
- Balance practice across multiple skill dimensions
- Enable "skill tree" UIs showing per-tag mastery

**Performance Multi-Dimensionality** (packages/common/src/course-data.ts:115):
The `Performance` type supports nested skill assessment:
```typescript
type Performance = number | { [dimension: string]: Performance };
```

Future Questions could return:
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

Enabling multi-objective optimization of learning paths.

## Key Architectural Benefits

### 1. Separation of Concerns
- **Questions** define *what* constitutes mastery (`isCorrect`, `displayedSkill`)
- **SRS** defines *when* to review (scheduling algorithm)
- **Navigators** define *which* cards to surface (content selection)
- **SessionController** orchestrates the whole (queue management)

### 2. Data-Driven Refinement
- **User ELO** adjusts based on performance → personalized difficulty
- **Card ELO** adjusts based on all users → course-wide calibration
- **Navigation strategies** can be A/B tested per user cohort
- **Initial intervals** can become population-informed (currently hardcoded)

### 3. Research-Friendly
The architecture supports pedagogical experiments:
- Log `Performance` data for analysis
- Compare navigation strategies across cohorts
- Export `CardHistory` for learning analytics
- Validate mastery claims via multi-dimensional ELO

### 4. Composable Complexity
Simple courses work out-of-box with ELO navigator. Advanced courses can:
- Implement custom navigators for domain-specific pedagogy
- Layer multiple strategies (global ELO + local interventions)
- Experiment with novel scheduling algorithms without touching SRS code

---

## Summary

Vue-Skuilder's pedagogy system provides:

**Out-of-the-box**: An adaptive learning system superior to naive SRS, where both users and content evolve together via dual-dynamic ELO rating.

**For researchers**: Ready extension points to experiment with novel pedagogical strategies via the `ContentNavigator` abstraction.

**For the future**: Multi-dimensional skill tracking infrastructure (per-tag ELO, nested performance metrics) ready to power sophisticated adaptive tutoring systems.

The system embodies a philosophy: *Good defaults with clear paths to sophisticated customization*.
