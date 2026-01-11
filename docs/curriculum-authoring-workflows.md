# Curriculum Authoring & Composition Workflows

A reference guide for agentic workflows designing educational content, curriculum flow, and course composition in Vue-Skuilder.

---

## Quick Start: What Can Agents Do?

Vue-Skuilder provides **three mechanical entry points** for curriculum authoring:

### 1. **Create Educational Content (Cards)**
Agents can create individual flashcards, quizzes, puzzles, etc. through:
- **MCP Tools**: `create_card()`, `update_card()`, `tag_card()`
- **UI Form**: DataInputForm with field-specific inputs
- **Bulk Import**: Markdown-like syntax for batch operations

**Supported Card Types**: String, Number, Integer, Markdown, MIDI, Chess Puzzles + custom types

### 2. **Author Navigation Strategies**
Agents can design curriculum **flow logic** (which cards appear when) through:
- **UI Forms**: Four strategy configuration editors (visual + JSON)
- **MCP**: Strategy document creation (partial - needs enhancement)
- **Database API**: Direct ContentNavigationStrategyData document creation

**Strategy Types**: Hierarchy (prerequisites), Interference (confusable content), RelativePriority (utility), HardcodedOrder (fixed sequences)

### 3. **Compose Curriculum via Pipeline Assembly**
Agents can combine strategies into adaptive learning flows through:
- **Pipeline Architecture**: Delegate pattern for layered strategy composition
- **Strategy Documents**: Stored in course database, persisted configuration
- **Tag-Based Organization**: Filter and group content by semantic tags

---

## Workflow 1: Creating Educational Content

### Entry Points

**UI-Driven (Human + Agent Assistance)**:
- `/packages/edit-ui/src/components/CourseEditor.vue` — Main authoring hub
- `/packages/edit-ui/src/components/ViewableDataInputForm/` — Field input system
- `/packages/edit-ui/src/components/BulkImportView.vue` — Batch import

**Programmatic (Agent-Driven)**:
- **MCP Tool**: `/packages/mcp/src/tools/create_card.ts`
- **Resource Query**: `/packages/mcp/src/resources/cards.ts` (list, filter, inspect)
- **Prompt Guidance**: `/packages/mcp/src/prompts/fill-in-card-authoring.ts`

### Content Data Model

```typescript
// From: packages/db/src/core/types/types-legacy.ts
interface Card {
  _id: CardId;
  docType: DocType.CARD;
  courseId: string;
  shapeId: string;           // Which DataShape template
  data: Record<string, any>; // Card-specific fields
  tags: string[];            // Semantic labels
  elo: CourseElo;            // Difficulty tracking
}

interface CourseElo {
  global: EloRank;
  tags: { [tagId: string]: EloRank };
}

interface EloRank {
  score: number;  // Difficulty rating (centered ~1000)
  count: number;  // Confidence / interaction count
}
```

### Creating Cards via MCP

```bash
# Query available card shapes and tags
resources: cards://all
resources: shapes://all
resources: tags://all

# Create a new card
tools: create_card
  - courseId: "my-course"
  - shapeId: "fill-in-blank"
  - data: { text: "...", answers: [...] }
  - tags: ["vocabulary", "beginner"]
  - elo: { global: { score: 1200, count: 0 } }

# Update or tag existing cards
tools: update_card
tools: tag_card
```

### Card Shape (DataShape) System

A **DataShape** is a reusable template for a card type:

```typescript
// From: packages/db/src/core/types/
interface DataShape {
  _id: DataShapeId;
  docType: DocType.DATASHAPE;
  name: string;
  fields: Field[];        // Strongly-typed field definitions
  question?: QuestionType; // Associated Question implementation
}

interface Field {
  name: string;
  type: 'string' | 'number' | 'integer' | 'markdown' | ...;
  required?: boolean;
}
```

**Built-in Shapes**:
- `fill-in-blank` — Flashcard with fill-in-the-blank syntax: `{{answer}}`
- `multiple-choice` — MCQ cards
- Custom shapes registered per-course

**Registration**: `/packages/edit-ui/src/components/ComponentRegistration.vue`

### Tag System

Tags are **semantic labels** for curriculum organization:

```typescript
interface Tag {
  _id: TagId;
  docType: DocType.TAG;
  courseId: string;
  name: string;          // Human-readable name
  hierarchyId?: string;  // Optional hierarchy nesting
}
```

**Usage in Workflows**:
- Filter cards: `tags://tag/{tagName}`
- Find tag stats: `tags://stats` or `tags://{tagName}`
- Combine filters: `tags://union/{tag1},{tag2}` (OR logic)
- Find cards with all tags: `tags://intersect/{tag1},{tag2}` (AND logic)
- Exclusive filtering: `tags://exclusive/{tag1}/{tag2}` (tag1 but not tag2)

**Key Concept**: Tags are how strategies reference content groups. All filtering, gating, and prioritization happens via tag matching.

---

## Workflow 2: Authoring Navigation Strategies

### Entry Points

**UI-Driven**:
- `/packages/edit-ui/src/components/NavigationStrategy/NavigationStrategyEditor.vue` — Full editor (CRUD + dual input modes)
- `/packages/edit-ui/src/components/NavigationStrategy/HierarchyConfigForm.vue`
- `/packages/edit-ui/src/components/NavigationStrategy/InterferenceConfigForm.vue`
- `/packages/edit-ui/src/components/NavigationStrategy/RelativePriorityConfigForm.vue`

**Programmatic**:
- **Database Interface**: `/packages/db/src/core/interfaces/navigationStrategyManager.ts`
  - `addNavigationStrategy(data: ContentNavigationStrategyData)`
  - `updateNavigationStrategy(id, data)`
  - `getAllNavigationStrategies()`

**Reference**: `/packages/db/docs/todo-strategy-authoring.md` — Complete UI/UX guide

### Navigation Strategy Model

```typescript
// From: packages/db/src/core/types/contentNavigationStrategy.ts
interface ContentNavigationStrategyData extends SkuilderCourseData {
  _id: `NAVIGATION_STRATEGY-${string}`;
  docType: DocType.NAVIGATION_STRATEGY;
  name: string;
  description: string;
  implementingClass: string;  // Which strategy class
  serializedData: string;     // JSON config (strategy-specific)
  role?: NavigatorRole;       // GENERATOR or FILTER
}

enum NavigatorRole {
  GENERATOR = 'generator',    // Produces candidate cards
  FILTER = 'filter',          // Transforms scores
}
```

### The Four Built-In Strategy Types

#### 1. **HierarchyDefinition** — Prerequisite Gating

**Purpose**: Lock advanced cards until prerequisites are mastered

**Config**:
```typescript
interface HierarchyConfig {
  prerequisites: {
    [tagId: string]: {
      tag: string;
      masteryThreshold?: {
        minElo?: number;       // User must reach this difficulty
        minCount?: number;     // User must attempt this many times
      };
    }[];
  };
}
```

**Example**: Unlock "long-division" cards only after "multiplication-facts" ELO ≥ 1050 AND count ≥ 20

**Implementation**: Acts as a FILTER that scores 0 (excludes) locked cards

#### 2. **InterferenceMitigator** — Confusable Content Spacing

**Purpose**: Prevent similar concepts from appearing too close together

**Config**:
```typescript
interface InterferenceConfig {
  interferenceSets: {
    tags: string[];          // Mutually confusable tags
    decay?: number;          // How quickly penalty fades
  }[];
  maturityThreshold?: {      // When concepts are mature enough
    minCount?: number;
    minElo?: number;
  };
}
```

**Example**: Space "letter-b" and "letter-d" cards apart for new readers; allow mixing after mastery

**Implementation**: Acts as a FILTER that penalizes scores for recently-seen interfering content

#### 3. **RelativePriority** — Utility-Based Boosting

**Purpose**: Boost high-value content (e.g., common words, core concepts)

**Config**:
```typescript
interface RelativePriorityConfig {
  tagPriorities: {
    [tagId: string]: number; // 0-1 priority score
  };
  defaultPriority?: number;
  combineMode?: 'max' | 'average' | 'min';  // When card has multiple tags
}
```

**Example**: Boost high-frequency vocabulary (priority 0.9) over rare words (0.3)

**Implementation**: Acts as a FILTER that multiplies scores by priority values

#### 4. **HardcodedOrder** — Fixed Sequences

**Purpose**: Present cards in a predetermined order

**Example**: Tutorial: Lesson 1 → Lesson 2 → Lesson 3

**Implementation**: Acts as a GENERATOR that produces cards in sequence

### Strategy Composition: The Pipeline Pattern

Strategies compose via the **Pipeline architecture**:

```
Pipeline = Generator + [Filters...]

Generator: Produces candidate cards with initial scores
Filters:   Transform scores via multiplication (pure functions)
```

**Example Flow**:
1. **Generator** (ELO) produces candidates: `[card1@0.85, card2@0.72, card3@0.91]`
2. **HierarchyDefinition filter** gates by prerequisites
3. **InterferenceMitigator filter** penalizes confusable tags
4. **RelativePriority filter** boosts high-utility content
5. **Final result**: Scored & filtered card list

**Key Properties**:
- Filters are **multipliers**: `score' = score × multiplier`
- **Order-independent**: Multiplication is commutative
- **Composable**: Add/remove filters without changing generator

**Provenance Tracking**: Each card carries audit trail showing which strategy contributed each score change and why

---

## Workflow 3: Composing Curriculum via Pipeline Assembly

### Entry Points

**Programmatic**:
- **Course DB API**: `/packages/db/src/core/interfaces/courseDB.ts`
  - `createNavigator()` — Assembles pipeline from course's strategies
- **Pipeline Assembly**: `/packages/db/src/core/navigators/PipelineAssembler.ts`
  - `assemble(strategies, user, course)` → Pipeline

**Study Session Integration**:
- Pipeline called by SessionController to fetch next N cards
- Called repeatedly throughout study session

### Pipeline Architecture

The Pipeline is the **curriculum execution engine**:

```typescript
// From: packages/db/src/core/navigators/Pipeline.ts
class Pipeline {
  constructor(
    generator: CardGenerator,     // Produces candidates
    filters: CardFilter[],         // Transform scores
    user: UserDBInterface,
    course: CourseDBInterface
  )

  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // 1. Build context (user ELO, thresholds, etc.)
    const context = await this.buildContext();

    // 2. Generate candidates
    let cards = await this.generator.getWeightedCards(fetchLimit, context);

    // 3. Batch-fetch shared data (tags, metadata)
    cards = await this.hydrateTags(cards);

    // 4. Apply filters sequentially
    for (const filter of this.filters) {
      cards = await filter.transform(cards, context);
    }

    // 5. Return top N (sorted by score, zero-scores excluded)
    return cards
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
```

### How Strategies Map to Pipeline

**PipelineAssembler** translates strategy documents to pipeline components:

```
ContentNavigationStrategyData
  ↓ (inspect implementingClass & role)
  ├─ role: GENERATOR → instantiate as CardGenerator
  ├─ role: FILTER → instantiate as CardFilter
  └─ serializedData: parse JSON config → pass to constructor

Result: Pipeline(generator, [filter1, filter2, ...])
```

### Data Hydration Optimization

Before filters run, Pipeline batch-fetches data all filters need:

```typescript
// Filters declare data dependencies
async transform(cards: WeightedCard[], context: FilterContext) {
  // Tags already pre-fetched on cards
  const tags = card.tags;  // No additional DB query needed
  ...
}
```

**Benefit**: 1 batch query instead of N filter queries

### Weighted Card Structure

Each candidate card carries:

```typescript
interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;                    // 0-1 suitability
  provenance: StrategyContribution[];  // Audit trail
  tags?: string[];                  // Pre-fetched
}

interface StrategyContribution {
  strategy: string;           // Type: 'elo', 'hierarchy', etc.
  strategyName: string;       // Human-readable: "Hierarchy: Phonics"
  strategyId: string;         // Document ID
  action: 'generated' | 'passed' | 'boosted' | 'penalized';
  score: number;              // Score after this step
  reason: string;             // Explanation for debugging
}
```

**Provenance enables**:
- Transparency: "Why did this card get scored 0.72?"
- Debugging: "Which strategy penalized it?"
- A/B testing: "Did switching to RelativePriority help?"

### Default Pipeline (No Strategies Configured)

If course has no strategies defined:

```typescript
Pipeline(
  CompositeGenerator([ELONavigator, SRSNavigator]),
  [eloDistanceFilter]
)
```

Rationale:
- **ELO + SRS generators**: Adaptive difficulty + scheduling
- **ELO distance filter**: Avoid cards too far from user skill level

---

## Workflow 4: Agent-Assisted Curriculum Design

### Available MCP Resources

**Read-only data access for curriculum inspection**:

| Resource | Purpose |
|----------|---------|
| `course://config` | Course metadata, ELO stats |
| `cards://all` | All cards (with pagination) |
| `cards://tag/{tag}` | Filter by tag |
| `cards://shape/{shape}` | Filter by card shape |
| `cards://elo/{range}` | Filter by difficulty (e.g., "1000-1100") |
| `shapes://all` | Available card templates |
| `shapes://{name}` | Template details (fields, question type) |
| `tags://all` | All course tags |
| `tags://stats` | Tag usage frequency |
| `tags://{name}` | Tag details |
| `tags://union/{tag1,tag2}` | Cards with ANY of these tags |
| `tags://intersect/{tag1,tag2}` | Cards with ALL these tags |
| `tags://exclusive/{tag1}/{tag2}` | Cards with tag1 NOT tag2 |
| `tags://distribution` | Tag frequency histogram |

### Available MCP Tools

**Write operations for curriculum authoring**:

| Tool | Purpose |
|------|---------|
| `create_card` | Create new card with validation |
| `update_card` | Modify existing card |
| `tag_card` | Add/remove tags with ELO update |
| `delete_card` | Safe deletion with confirmation |

### Authoring Prompts

**Guided workflows for specific card types**:

| Prompt | Domain |
|--------|--------|
| `fill-in-card-authoring.md` | Fill-in-the-blank syntax & best practices |
| `elo-scoring-guidance.md` | ELO assignment guidance |

### Example Agent Workflow: Build a Reading Course

```
1. Query available card shapes
   resources: shapes://all
   → Find "fill-in-blank" shape available

2. Inspect course tags
   resources: tags://all
   → Identify existing tag structure

3. Create cards (agent-assisted)
   Use prompt: fill-in-card-authoring.md
   tools: create_card (multiple times)
   tags: ["phonics", "level-1"], ["sight-words", "level-1"], etc.

4. Check coverage
   resources: cards://tag/phonics
   resources: tags://stats
   → Verify all core concepts have cards

5. Design navigation strategy
   Create HierarchyDefinition strategy:
   - prerequisites: { "level-2": [{ tag: "level-1", masteryThreshold: { minElo: 1050 } }] }

6. Compose final curriculum
   database.updateNavigationStrategies(strategyDocs)
   → Course now enforces level progression
```

---

## Workflow 5: Extending with Custom Strategies

### Creating a New Strategy Type

**Reference**: `/packages/db/docs/navigators-architecture.md` — Creating New Strategies section

### Custom Generator Example

```typescript
// src/core/navigators/myGenerator.ts
import { ContentNavigator, CardGenerator, WeightedCard } from '@db/core/navigators';

class MyGenerator extends ContentNavigator implements CardGenerator {
  name = 'My Custom Generator';

  async getWeightedCards(limit: number, context?: GeneratorContext): Promise<WeightedCard[]> {
    const candidates = await this.findCandidates(limit);

    return candidates.map(c => ({
      cardId: c.id,
      courseId: this.course.getCourseID(),
      score: this.computeScore(c),
      provenance: [{
        strategy: 'myGenerator',
        strategyName: this.name,
        strategyId: this.strategyId || 'MY_GENERATOR',
        action: 'generated',
        score: this.computeScore(c),
        reason: 'Custom logic explanation'
      }]
    }));
  }
}
```

### Custom Filter Example

```typescript
// src/core/navigators/myFilter.ts
import { ContentNavigator, CardFilter, WeightedCard } from '@db/core/navigators';

class MyFilter extends ContentNavigator implements CardFilter {
  name = 'My Custom Filter';

  async transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]> {
    return cards.map(card => {
      const multiplier = this.computeMultiplier(card, context);
      const newScore = card.score * multiplier;
      const action = multiplier < 1 ? 'penalized' : multiplier > 1 ? 'boosted' : 'passed';

      return {
        ...card,
        score: newScore,
        provenance: [...card.provenance, {
          strategy: 'myFilter',
          strategyName: this.name,
          strategyId: this.strategyId || 'MY_FILTER',
          action,
          score: newScore,
          reason: 'Custom filter logic explanation'
        }]
      };
    });
  }

  // Legacy requirement - filters use transform()
  async getWeightedCards() {
    throw new Error('Use transform() via Pipeline');
  }
}
```

### Registering Custom Strategies

Update `NavigatorRoles` enum and register in `PipelineAssembler`

---

## Strategy State & User Preferences

### User-Scoped Strategy State

Strategies can persist user-specific state (preferences, learned patterns):

```typescript
// From: packages/db/src/core/types/strategyState.ts
interface StrategyStateDoc<T> {
  _id: StrategyStateId;  // Format: "STRATEGY_STATE::{courseId}::{strategyKey}"
  docType: DocType.STRATEGY_STATE;
  courseId: string;
  strategyKey: string;
  data: T;
  updatedAt: string;
}
```

**Storage API** (available in ContentNavigator):
```typescript
protected async getStrategyState<T>(): Promise<T | null>
protected async putStrategyState<T>(data: T): Promise<void>
protected get strategyKey(): string  // Override for custom key
```

### Example: User Tag Preferences

```typescript
interface UserTagPreferenceState {
  boost: Record<string, number>;  // Tag multipliers: 0=exclude, 1=neutral, 2=boost
  updatedAt: string;
}

// In filter's transform():
const prefs = await this.getStrategyState<UserTagPreferenceState>();
if (prefs) {
  const multiplier = computeMultiplier(card.tags, prefs.boost);
  card.score *= multiplier;
}
```

**UI Component**: `/packages/common-ui/src/components/UserTagPreferences.vue`
- Slider-based interface
- User-configured tag preferences
- Syncs to strategy state

---

## Key Concepts for Agents

### Score Semantics (0-1 Range)

| Score | Meaning |
|-------|---------|
| 1.0 | Fully suitable |
| 0.5 | Neutral / no preference |
| 0.0 | Exclude (hard filter) |
| 0.x | Proportional suitability |

**Important**: All filters are **multipliers**. Score 0 from any filter excludes the card permanently.

### Filter Order Independence

Because filters multiply scores:
- `Filter1(Filter2(cards))` = `Filter2(Filter1(cards))`
- Filters applied alphabetically for determinism
- Order in provenance shows actual execution sequence

### Tags as the Curriculum Abstraction

Everything in curriculum design flows through tags:
- **Content organization**: Cards grouped by tags
- **Filtering**: Strategies reference tags to select content
- **Mastery tracking**: ELO per tag tracks skill progress
- **Preferences**: Users express preferences per tag

**Design principle**: Use tags to model curriculum structure (domains, difficulty levels, concepts)

---

## Testing & Validation

### Card Design Validation

**MCP provides**:
- Syntax checking for card syntax (e.g., fill-in-blank format)
- Field type validation against DataShape
- ELO range validation
- Tag existence verification

### Strategy Testing (Future)

**Foundation exists** for:
- A/B testing strategy configurations
- Cohort assignment
- Strategy effectiveness measurement

**Reference**: `/packages/db/docs/todo-evolutionary-orchestration.md`

---

## Reference Documentation

### Core Architecture
- **Main Guide**: `/packages/db/docs/navigators-architecture.md`
- **Strategy Authoring**: `/packages/db/docs/todo-strategy-authoring.md`
- **Pedagogy System**: `/docs/learn/pedagogy.md`
- **Card Model**: `/docs/learn/card-data-model.md`
- **System Architecture**: `/docs/learn/architecture.md`

### API Reference
- **Navigation Strategy Manager**: `/packages/db/src/core/interfaces/navigationStrategyManager.ts`
- **Course DB Interface**: `/packages/db/src/core/interfaces/courseDB.ts`
- **Content Source**: `/packages/db/src/core/interfaces/contentSource.ts`
- **Types**: `/packages/db/src/core/types/`

### Implementation
- **Navigators**: `/packages/db/src/core/navigators/`
- **Edit UI**: `/packages/edit-ui/src/components/`
- **MCP**: `/packages/mcp/src/`

---

## Agentic Workflow Best Practices

### 1. **Inspect Before Creating**
- Query existing cards, tags, shapes before bulk creation
- Validate against tag hierarchy
- Check ELO distribution for consistency

### 2. **Use Tags for Organization**
- Model curriculum as tag network (concept graph)
- Each strategy references tags, not individual cards
- Tags enable composition and modularity

### 3. **Build Composable Strategies**
- Use delegate pattern for layering
- Each filter has single responsibility (prerequisite, interference, priority)
- Compose simple filters into complex behaviors

### 4. **Validate Provenance**
- Check strategy output for expected provenance
- Verify which filters contributed to final scores
- Debug unexpected card selections via audit trail

### 5. **Leverage ELO for Adaptation**
- Initial ELO assignment guides difficulty targeting
- System refines through learner interactions
- Per-tag ELO enables fine-grained skill tracking

### 6. **Plan for Evolution**
- Store strategies as documents (not code)
- Design with measurement in mind (for future A/B testing)
- Think about strategy variants for future comparison

---

## Next Steps for Agents

To build a curriculum:

1. **Define Content Model**: Identify card shapes, field types needed
2. **Organize by Tags**: Create tag hierarchy representing curriculum structure
3. **Create Content**: Use MCP tools to author cards (agent-assisted with prompts)
4. **Design Strategies**: Build navigation strategies targeting learning goals
5. **Compose Pipeline**: Assemble strategies into final curriculum flow
6. **Validate**: Query final state, inspect provenance, check coverage

All of this can be done through MCP resources and tools—agents can design curriculum **without code modifications**.
