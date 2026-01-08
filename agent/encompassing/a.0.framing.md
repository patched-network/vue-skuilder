# Framing: Encompassing Relationships

*Separated workstream from orchestration/evolution*

---

## The Idea

### What Is Encompassing?

An **encompassing relationship** exists when practicing skill A implicitly exercises skill B.

**Example**: Solving a two-digit addition problem implicitly practices single-digit addition—you can't do `26 + 31` without doing `6 + 1` and `2 + 3`.

This is **distinct from prerequisites**:

| Relationship | Question | Affects |
|--------------|----------|---------|
| **Prerequisite** | "What must I learn first?" | Learning order |
| **Encompassing** | "What do I practice when I do this?" | Review scheduling, credit flow |

A prerequisite says "learn B before A." An encompassing says "doing A counts as practice for B."

**Ref**: MathAcademyWay Chapter 4 ("Core Technology: the Knowledge Graph") §Encompassings Enable Turbo-Boosted Learning Speed

### Why It Matters

Encompassing relationships enable **learning efficiency optimization**:

1. **Reduced explicit review**: If practicing A covers B, don't explicitly review B
2. **Repetition compression**: Choose tasks that "knock out" multiple due reviews
3. **Turbo-boosted progress**: Learn new material while maintaining old

MA achieves ~1 explicit review per topic on average due to encompassing density. Without encompassings, every skill needs explicit review (flashcard mode = minimum efficiency).

**Ref**: MathAcademyWay Chapter 31 ("Technical Deep Dive on Learning Efficiency")

### MA's Implementation: FIRe

Math Academy's **Fractional Implicit Repetition (FIRe)** algorithm:

- Success on advanced topic → credit flows **down** to encompassed topics
- Failure on simple topic → penalty flows **up** to encompassing topics
- Credit decays through partial encompassings
- Multi-level chaining through the encompassing graph

**Ref**: MathAcademyWay Chapter 29 ("Technical Deep Dive on Spaced Repetition")

---

## Mapping to Our System

### What We Have

**Multi-dimensional ELO**: Tags define skill dimensions. Cards and users have per-tag ELO scores. On interaction, each dimension updates independently (vector-based).

**Implicit encompassing via ELO dynamics**: As users succeed on harder tag-X material, their tag-X ELO rises, making easier tag-X material less attractive. This approximates encompassing behavior—you "outgrow" simpler content.

**Question type composition**: Strongly-typed questions can embed other question types. `TwoDigitAddition` internally uses `SingleDigitAddition`. The structure exists at implementation level.

### What's Missing

**Explicit encompassing relationships**: No way to declare "tag A encompasses tag B" or "question type X encompasses question type Y."

**Cross-dimension credit flow**: Success on a card tagged `two-digit-addition` doesn't credit the `single-digit-addition` dimension, even though the former encompasses the latter.

**Priority adjustment from implicit practice**: Encompassed skills don't become lower priority after being implicitly exercised.

### Scheduling Semantic Difference

Our system differs from Anki/MA:

| System | Model |
|--------|-------|
| Anki/MA | Card scheduled for specific day, expected to be reviewed |
| Skuilder | Card becomes *eligible for review*, competes on priority |

This changes how encompassing credit applies:

- **Anki/MA**: Push back the scheduled date of encompassed cards
- **Skuilder**: Reduce the *priority* of encompassed cards

This may actually be simpler—encompassing just affects priority weighting in generators, not date management.

---

## Potential Implementation Mechanisms

### Option A: EncompassingDefinition Strategy

New NavigationStrategy type, analogous to `HierarchyDefinition`:

```typescript
interface EncompassingDefinitionData extends ContentNavigationStrategyData {
  type: 'EncompassingDefinition';

  // Tag A encompasses Tag B
  relationships: Array<{
    encompasser: TagID;    // The advanced skill
    encompassed: TagID;    // The skill practiced implicitly
    weight?: number;       // 0-1, default 1.0 (full encompassing)
  }>;
}
```

**As a Filter**: After card selection, adjust scores of cards tagged with encompassed skills based on recent practice of encompassing skills.

```typescript
class EncompassingPriorityFilter implements CardFilter {
  // If user recently practiced cards with encompasser tags,
  // reduce priority of cards with encompassed tags
  async transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]> {
    const recentEncompassers = await this.getRecentPractice(context.userId);

    return cards.map(card => {
      const implicitCredit = this.computeImplicitCredit(card.tags, recentEncompassers);
      // Reduce priority proportional to implicit credit received
      return {
        ...card,
        score: card.score * (1 - implicitCredit * this.weight),
      };
    });
  }
}
```

**As ELO modifier**: On card interaction, propagate ELO updates to encompassed dimensions.

```typescript
// After normal ELO update on card interaction:
async function propagateEncompassingCredit(
  userId: string,
  cardTags: TagID[],
  outcome: 'success' | 'failure',
  encompassings: EncompassingRelationship[]
) {
  for (const tag of cardTags) {
    const encompassed = encompassings.filter(e => e.encompasser === tag);
    for (const rel of encompassed) {
      // Credit flows down on success
      if (outcome === 'success') {
        await adjustUserTagElo(userId, rel.encompassed, {
          direction: 'up',
          factor: rel.weight * ENCOMPASSING_CREDIT_FACTOR,
        });
      }
    }
  }

  // Failure flows up (optional, more complex)
  if (outcome === 'failure') {
    // ...
  }
}
```

### Option B: Question Type Composition Inference

Leverage existing question type embedding:

```typescript
// Question types declare their composition
abstract class Question {
  // Override in composite questions
  static encompassedTypes?: QuestionType[];
}

class TwoDigitAddition extends Question {
  static encompassedTypes = [SingleDigitAddition];
  // ...
}
```

System generates tags from question types and infers encompassing relationships:

```typescript
// System-generated tag prefix
const SGT_PREFIX = 'sgt:';

function questionTypeToTag(qt: QuestionType): TagID {
  return `${SGT_PREFIX}${qt.name}`;
}

function inferEncompassings(questionTypes: QuestionType[]): EncompassingRelationship[] {
  return questionTypes
    .filter(qt => qt.encompassedTypes?.length)
    .flatMap(qt =>
      qt.encompassedTypes!.map(encompassed => ({
        encompasser: questionTypeToTag(qt),
        encompassed: questionTypeToTag(encompassed),
        weight: 1.0,
        source: 'inferred',
      }))
    );
}
```

### Option C: Learned Encompassings

Infer encompassing relationships from observed transfer:

```typescript
// If success on tag-A cards predicts maintained skill on tag-B
// (without explicit tag-B practice), infer A encompasses B

interface ObservedTransfer {
  tagA: TagID;
  tagB: TagID;
  correlation: number;      // How well A-practice predicts B-retention
  sampleSize: number;
  confidence: number;
}

function inferEncompassingFromTransfer(
  observations: ObservedTransfer[],
  threshold: number = 0.7
): EncompassingRelationship[] {
  return observations
    .filter(o => o.correlation >= threshold && o.confidence >= 0.6)
    .map(o => ({
      encompasser: o.tagA,
      encompassed: o.tagB,
      weight: o.correlation,
      source: 'learned',
    }));
}
```

### Option D: Hybrid

Combine approaches:

1. **Authored** encompassings via `EncompassingDefinition` strategy (explicit)
2. **Inferred** from question type composition (structural)
3. **Learned** from observed transfer (emergent)

Weights could be:
- Binary for authored/inferred (1.0)
- Continuous for learned (correlation strength)
- Learnable for all (orchestration layer refines weights)

---

## Integration with Orchestration Layer

When the orchestration layer is operational, encompassing strategies can be treated like any other strategy:

- **Weight**: How strongly to apply encompassing-based priority adjustment
- **Learnable**: Does applying this encompassing relationship improve learning efficiency?
- **Cohort variation**: Different users experience different encompassing weights

This keeps the concerns separate:
- **Orchestration**: Learns *whether* a strategy helps
- **Encompassing**: Defines *what* the encompassing relationships are

---

## Open Questions

### Representation

- Where do encompassing relationships live? (Strategy doc? Separate store? Tag metadata?)
- Per-course or global?
- Authored vs inferred vs learned vs hybrid?

### Mechanics

- Priority reduction vs ELO credit propagation vs both?
- Single-hop only or multi-level chaining?
- Bidirectional (success down, failure up) or just downward?

### Granularity

- Tag-level encompassings (tag A → tag B)?
- Card-level encompassings (specific cards)?
- Question-type-level encompassings (structural inference)?

### Integration

- How does this interact with existing SRS scheduling?
- Does priority reduction conflict with other filters?
- Performance impact of computing encompassing credit?

---

## References

### MathAcademyWay Chapters

| Chapter | Section | Relevance |
|---------|---------|-----------|
| 4 | §Encompassings Enable Turbo-Boosted Learning Speed | Core concept |
| 29 | §Fractional Implicit Repetition (FIRe) | Credit flow algorithm |
| 29 | §Partial Encompassings | Weighted relationships |
| 29 | §Setting Encompassing Weights Manually | Authoring approach |
| 31 | §What is Learning Efficiency? | Why encompassings matter |
| 31 | §Repetition Compression | Optimization mechanism |

### Location

`/home/colin/pn/cm/main/ref/MathAcademyWay/`

---

## Relationship to Orchestration Workstream

This workstream is **separated from** `agent/orchestrator/` because:

1. Orchestration can proceed without encompassings (learning loop works on any strategy)
2. Encompassings are an optimization, not a prerequisite
3. When implemented, encompassing strategies integrate with orchestration like any other strategy

**Dependency**: Orchestration first, encompassing later (but can be parallelized for design work).

---

*Last updated: scope separation from orchestration workstream*
