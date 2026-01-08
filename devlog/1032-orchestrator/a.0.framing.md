# Framing: Evolutionary Orchestration

*Checkpoint document - collaborative exploration toward spec*

---

## Context

### What Is This Project?

A learning platform with:
- **Content**: Cards (micro-content) organized by tags (curriculum vocabulary)
- **Navigation**: Strategies that encode opinions about how to traverse content
- **Adaptation**: ELO on both users and content, SRS scheduling

### What Are We Designing?

An **orchestration layer** that:
- Allows multiple navigation strategies to compete
- Learns which strategies work (for whom, toward what goals)
- Surfaces signal back to authors about content/strategy effectiveness
- Operates as infrastructure, not opinion - accepts goals from above

### Why Now?

The navigator architecture exists (`packages/db/docs/navigators-architecture.md`). Strategies can be authored and composed. What's missing:
- Mechanism for strategies to *compete* rather than just compose
- Learning loop that improves strategy weights over time
- Signal flow from user outcomes back to content/strategy authors

---

## Goals

### Immediate Goal

Design an orchestration layer that enables **evolutionary selection** of navigation strategies based on observed learning outcomes.

### Design Constraints

1. **Incremental**: Each phase delivers value; can pause anywhere
2. **Non-breaking**: New fields optional; defaults preserve current behavior
3. **Goal-agnostic**: Optimization signal injected from above, not hardcoded
4. **Signal-flexible**: Can accept different definitions of "success" for different contexts

### Success Criteria (Eventual)

- Strategies with better outcomes gain influence over time
- Content that causes barriers is surfaced to authors
- System improves without manual tuning
- Authors can observe what's working

---

## Prior Art: Math Academy

Reference: `/home/colin/pn/cm/main/ref/MathAcademyWay/`

Math Academy implements a sophisticated adaptive learning system. Key concepts relevant to our design:

### Concept Mapping

| MA Concept   | Our Current State | Gap |
|--------------|------------------|-----|
| Topics                | Cards + Tags | Have it |
| Prerequisites         | HierarchyDefinition strategy | Have it |
| Encompassings         | Implicit only (see below) | Explicit representation needed |
| FIRe (credit trickle) | Partial via ELO dynamics | Systematic implementation needed |
| Learning Efficiency | Could measure | Signal opportunity |
| Repetition Compression | Missing | Generator opportunity |

### Prerequisites vs Encompassings

These are related but distinct relationship types:

| Aspect | Prerequisite | Encompassing |
|--------|-------------|--------------|
| **Question** | "What must I learn first?" | "What do I practice when I do this?" |
| **Affects** | Learning **order** | Credit **flow** |
| **System use** | Sequencing, unlocking | Review scheduling, implicit reps |

**Ref**: MA Chapter 4 ("Core Technology: the Knowledge Graph") §Encompassings Enable Turbo-Boosted Learning Speed

#### Examples That Clarify the Distinction

**Both prerequisite AND encompassing** (common case):
- TwoDigitAddition → SingleDigitAddition
- Prerequisite: "Learn single-digit first"
- Encompassing: "Every two-digit problem exercises single-digit skills"

**Prerequisite but NOT encompassing**:
- "Understanding variables" → "Solving equations"
- You need the concept, but solving equations doesn't *practice* understanding variables—it assumes it

**Encompassing but NOT prerequisite**:
- Advanced statistics problem → Basic statistics skills
- You could learn the advanced version directly; doing it clearly exercises the basics
- MA calls these "non-ancestor encompassings" (Chapter 29)

#### Why This Matters

For spaced repetition:
- If A encompasses B, success on A can **skip explicit review** of B
- If A has B as prerequisite but doesn't encompass B, explicit review still needed

This is the core of MA's FIRe algorithm (Chapter 29: "Technical Deep Dive on Spaced Repetition"):
- Success on advanced → credit flows **down** to encompassed topics
- Failure on simple → penalty flows **up** to encompassing topics

### Learning Efficiency

**Ref**: MA Chapter 31 ("Technical Deep Dive on Learning Efficiency"), Chapter 22 ("Gamification") §Learning Efficiency

MA defines learning efficiency as:

```
efficiency = progress_made / work_invested
```

Where:
- **progress** = topics mastered (course completion %)
- **work** = XP spent (calibrated: 1 XP ≈ 1 minute focused work)

**Theoretical bounds**:
- **Maximum**: Never need explicit reviews (all covered via encompassings)
- **Minimum**: Flashcard mode (every review explicit, no encompassings)

**Factors affecting efficiency** (Chapter 31):
1. **Performance quality** (dominant) - pass rate × accuracy
2. **Encompassing utilization** (structural) - system uses encompassings to cover reviews
3. **Pace** (minor, ~pace^0.1) - enough work to stay ahead of due reviews

MA achieves ~1 explicit review per topic on average due to encompassing density.

### Repetition Compression

**Ref**: MA Chapter 31 §Repetition Compression

When reviews are due, MA finds the **minimal set of tasks** that covers all due reviews via encompassings. Key quote:

> "Often, when we give a student a new lesson, we are actually knocking out one or more due reviews with that lesson."

This is a potential generator pattern for our system.

---

## Prior Art: Psychometrics & Learner Modeling

### Academic Foundations

The educational research community has formal frameworks for what MA (and our system) implement practically:

| Framework | Full Name | Core Idea |
|-----------|-----------|-----------|
| **IRT** | Item Response Theory | P(correct) = f(ability - difficulty) |
| **MIRT** | Multi-dimensional IRT | Ability is a vector, not scalar |
| **BKT** | Bayesian Knowledge Tracing | Track P(mastered) per skill with learning/forgetting |

**Key researcher**: Radek Pelánek - leading authority on Elo-based learner modeling for tutoring systems. His work on credit assignment across multiple skills is directly relevant.

### MA's Approach (Chapter 29)

MA doesn't use formal psychometric terminology but implements an equivalent model:

```
student_topic_learning_speed = student_ability / topic_difficulty
```

Where:
- **Student ability**: Per-topic accuracy, weighted toward recent answers, propagated through encompassing graph
- **Topic difficulty**: Accuracy across all students on that topic

This is functionally IRT, but:
- **Multi-dimensional**: Ability tracked per-topic (thousands of dimensions)
- **Graph-aware**: Ability propagates through encompassing relationships
- **Practical cold start**: Initial ability predicted from "local neighborhood" (prerequisites, encompassings, same-module topics)

### Our System's Approach: Multi-dimensional ELO

We already have a sophisticated vector-based skill tracking system:

**Structure**:
- **Tags** define dimensions (curriculum vocabulary)
- **Cards** have per-tag ELO scores (difficulty along each dimension)
- **Users** have per-tag ELO scores (ability along each dimension)

**Example**:
```
Card "TwoDigitAddition-Problem-42":
  elo[addition] = 1200
  elo[place-value] = 1350
  elo[mental-math] = 1100

User "alice":
  elo[addition] = 1180
  elo[place-value] = 1400
  elo[mental-math] = 1050
```

**On interaction**: Vector-based update - each tag-dimension compares user vs card ELO and updates independently. This is the most sophisticated approach in the credit assignment literature.

### Comparison

| Aspect | Standard MIRT | MA Model | Our Model |
|--------|--------------|----------|-----------|
| **Dimensions** | Fixed skill set | Topics (thousands) | Tags (curriculum vocabulary) |
| **Item difficulty** | Single value or skill loadings | Per-topic | Per-tag ELO on each card |
| **User ability** | Latent vector | Per-topic accuracy | Per-tag ELO |
| **Credit assignment** | Via skill loadings | Via encompassing graph | Vector-based (each dimension independent) |

### The Credit Assignment Problem

When a user interacts with a multi-tag card, how should success/failure propagate?

**Standard approaches** (from Pelánek's work):

| Approach | Logic | Tradeoff |
|----------|-------|----------|
| **Averaged** | Card difficulty = average of tag difficulties | Simple; one easy tag masks hard tags |
| **Weakest link** | Card difficulty = hardest required tag | Good for bottleneck concepts |
| **Proportional** | Blame/credit weighted by current estimates | If tag-A is weak, failure blames tag-A more |
| **Vector-based** | Each dimension updated independently | Most accurate; needs per-dimension data |

**Our system uses vector-based** - the most accurate approach. Each tag-ELO pair (user vs card) updates independently based on the outcome.

### What's Missing: Cross-Dimension Propagation

Our vector-based system updates each dimension independently. What it doesn't do (yet):

1. **Encompassing credit flow**: Success on a card tagged `two-digit-addition` doesn't automatically credit `single-digit-addition`, even though the former encompasses the latter

2. **Failure propagation upward**: Failure on `single-digit-addition` doesn't penalize confidence in `two-digit-addition` cards (which require single-digit skills)

3. **Cold start from neighborhood**: New cards/tags don't get initial estimates from related tags

This is exactly what MA's FIRe algorithm provides on top of basic per-topic tracking.

### Relevance to Orchestration Layer

The orchestration layer can enhance the existing ELO system:

1. **Encompassing relationships** as a navigation strategy that triggers cross-dimension credit flow
2. **Learning encompassing weights** from observed transfer (does success on A predict retention of B?)
3. **Cold start prediction** using local neighborhood in the tag graph

The vector-based ELO foundation is already strong. The gap is the relationship layer that connects dimensions.

---

## Existing State

### What Exists

| Component | Status | Location |
|-----------|--------|----------|
| Card/Tag data model | Stable | `packages/db` |
| ELO system (users + content) | Active, continuously updated | `packages/db` |
| Navigation strategies | Implemented | `packages/db/src/core/navigators` |
| Strategy composition (Pipeline, CompositeGenerator) | Implemented | Same |
| Provenance tracking | Implemented | Traces which strategy contributed what |

### Implicit Encompassing Mechanisms (Already Present)

The system has **three forms of implicit encompassing** that could be surfaced:

#### 1. Question Type Composition

Strongly-typed question implementations can embed other question types:

```typescript
// TwoDigitNoCarryAddition embeds SingleDigitAddition
// The structure exists at implementation level
class TwoDigitNoCarryAddition extends Question {
  // Internally creates two SingleDigitAddition sub-problems
  // UX guides methodology (highlighting 6+1, then 2+3)
}
```

**Gap**: No hard link between question composition and tagging infrastructure. If `TwoDigitNoCarryAddition` auto-assigned tags corresponding to `SingleDigitAddition`, encompassings would be explicit.

#### 2. Component Grading Signal

When composite questions are graded, component-level grading logic runs:

```typescript
// SingleDigitAddition grading applies to each embedded case
// Where it fails, could directly modify opinion on that skill domain
```

**Gap**: This signal isn't routed to affect skill tracking on component tags.

#### 3. Multidimensional ELO Dynamics

As users succeed on harder material under tag X:
- User's tag-X ELO rises
- Easier tag-X material becomes less attractive to ELO-based generators
- Material is "outgrown" and passed over (even if scheduled for review)

**Insight**: A well-tagged curriculum may *learn* its encompassings implicitly, expressed as content embedding in ELO-space. The multidimensional ELO already approximates some encompassing behavior.

### What's Missing (Explicit)

| Component | Status |
|-----------|--------|
| Strategy weighting | Not implemented - all strategies contribute equally |
| Outcome tracking | Not systematically recorded |
| Weight learning | No feedback loop |
| Cohort/variant mechanism | Not implemented |
| Explicit encompassing relationships | Not represented in data model |
| Credit trickle mechanism | Not implemented (implicit via ELO only) |

### Key Insight: ELO vs Utility

- **ELO on content** = difficulty calibration (hard cards have high ELO)
- **Utility** = effectiveness at producing learning (orthogonal to difficulty)

A hard card isn't bad. An *ineffective* card is bad. These are different signals.

---

## Architectural Layering

```
┌─────────────────────────────────────────────────────────┐
│  GOALS LAYER (above our scope)                          │
│                                                         │
│  - Explicit user goals ("I want to learn X")            │
│  - Implicit population demand (usage patterns)          │
│  - Goals for others ("I want surgeons to exist")        │
│  - Pluralistic curriculum authoring                     │
│  - Author reward mechanisms                             │
│                                                         │
│  OUTPUT: Optimization signal injected downward          │
└─────────────────────────┬───────────────────────────────┘
                          │
                          │ signal definition
                          │ (what does "success" mean?)
                          ▼
┌─────────────────────────────────────────────────────────┐
│  ORCHESTRATION LAYER (our focus)                        │
│                                                         │
│  - Strategies compete for influence                     │
│  - Weights are learned from outcomes                    │
│  - Cohort mechanism distributes exploration             │
│  - Content utility emerges from observation             │
│  - Encompassing relationships learned/refined           │
│                                                         │
│  INPUT: Signal from above, outcomes from below          │
│  OUTPUT: Card selection, effectiveness data             │
└─────────────────────────┬───────────────────────────────┘
                          │
                          │ card selection
                          │ (what to study next)
                          ▼
┌─────────────────────────────────────────────────────────┐
│  CONTENT LAYER (below our scope, mostly exists)         │
│                                                         │
│  - Cards (micro-content, has ELO)                       │
│  - Tags (curriculum vocabulary)                         │
│  - Navigation strategies (opinions about traversal)     │
│  - Courses as packages (can declare cross-dependencies) │
│  - User interactions (correct/incorrect/timing)         │
│  - Question type composition (implicit encompassings)   │
│                                                         │
│  OUTPUT: Interaction outcomes                           │
└─────────────────────────────────────────────────────────┘
```

---

## Signal Definition

### Short-term Signal: "Zone of Desirable Difficulty"

Not raw accuracy, but *appropriately challenged* accuracy:
- Success rate on higher end (80%+?) for SRS-style content
- But each success should be *effortful* (the digging encodes durably)
- Possible proxies: time-to-answer, hint usage, retry count

Maps to MA concept of "knowledge frontier" - working at the edge of what you know.

### Long-term Signal: ELO Gain

- Measured over weeks/months, not sessions
- Analogous to chess rating improvement over sustained training
- This is the *actual* learning outcome

### Derived Signal: Learning Efficiency

Following MA's model:

```typescript
interface LearningSignal {
  // Work invested
  cardsStudied: number;
  timeSpentMs: number;

  // Performance quality (short-term)
  accuracyInZone: number;    // % correct on appropriately-challenging content
  passRate: number;          // % of tasks passed first attempt

  // Progress (goal-dependent, injected from above)
  progressMetric: 'elo_gain' | 'tags_mastered' | 'course_completion' | 'custom';
  progressValue: number;

  // Derived
  efficiency: number;        // progressValue / work
}
```

**Efficiency is the primary signal** for evaluating strategies:
- High efficiency = good progress with minimal work
- Affected by: performance quality (dominant), encompassing utilization, pace (minor)

### Signal Injection Pattern

The orchestration layer doesn't define what "good" means. It accepts a signal definition from above and optimizes toward it. Different contexts might inject:
- "Maximize accuracy in zone" (skill building)
- "Maximize engagement" (habit formation)
- "Maximize breadth coverage" (survey learning)
- "Maximize ELO gain rate" (intensive improvement)

---

## Relationship Types

Navigation strategies encode opinions about content relationships. Key relationship types:

### Prerequisite (Exists: HierarchyDefinition)

- **Semantics**: "Learn B before A"
- **System use**: Ordering, unlocking content
- **Authored**: Yes (explicit in strategy)
- **Learnable**: Possibly (infer from failure patterns)

### Encompassing (Needed)

- **Semantics**: "Practicing A implicitly practices B"
- **System use**: Review scheduling, credit flow, efficiency optimization
- **Authored**: Yes (declared or inferred from question composition)
- **Learnable**: Yes (observe transfer: does A success predict B retention?)

### Interference (Exists: InterferenceMitigator)

- **Semantics**: "A and B confuse each other when learned together"
- **System use**: Spacing, avoid simultaneous presentation
- **Authored**: Yes (explicit in strategy)
- **Learnable**: Possibly (infer from confusion patterns)

### Potential Abstraction

```typescript
interface RelationshipType {
  name: 'prerequisite' | 'encompasses' | 'interferes';

  // How it can be established
  canBeAuthored: boolean;
  canBeInferredFromStructure: boolean;  // e.g., question composition
  canBeLearnedFromOutcomes: boolean;

  // What it affects
  affectsOrdering: boolean;      // prerequisite
  affectsCreditFlow: boolean;    // encompassing
  affectsSpacing: boolean;       // interference

  // Weight
  weight: number;                // 0-1, can be partial
  confidence: number;            // learned vs authored
}
```

---

## Open Questions

### Resolved (For Now)

| Question | Resolution |
|----------|------------|
| Update frequency | Continuous for ELO (exists), batched for strategy weights (simpler) |
| Tag utility | Drop - tags are vocabulary, not content. Focus on cards and relationships. |
| ELO relationship | Orthogonal. ELO = difficulty. Utility = effectiveness toward goals. |
| Scope | Focus on orchestration layer; pluralistic authoring is above us |
| Primary signal | Learning efficiency (progress/work), following MA model |
| Encompassing representation | Needed as explicit relationship type, learnable |

### Still Open

| Question | Notes |
|----------|-------|
| Cohort mechanism details | Bell curve vs uniform vs stratified? Cross-strategy correlation? |
| Cold start | New strategies/content: what initial weight and confidence? |
| Attribution | Multiple strategies active → how to credit outcomes? |
| Encompassing inference | How to surface implicit encompassings from question composition? |
| Credit trickle implementation | Full FIRe-style, or simpler approximation? |

---

## Next Steps

1. ~~Review MathAcademyWay reference for prior art~~ Done
2. ~~Refine signal definition based on prior art~~ Done (learning efficiency)
3. Design encompassing representation (as NavigationStrategy type? separate?)
4. Decide on credit trickle mechanism (full FIRe vs simpler)
5. Finalize cohort mechanism
6. Produce incremental implementation plan

---

*Last updated: collaborative session, post-MathAcademy review*
