# Card Data Model

## Overview

Vue-Skuilder's card architecture separates **presentation** from **content** through a flexible, strongly-typed system that enables both combinatorial content generation and compositional question design.

## Core Components

### 1. **DataShapes** - The Type System

A `DataShape` defines the structure of data that can populate a card:

```typescript
interface DataShape {
  name: DataShapeName;
  fields: FieldDefinition[];
}
```

Each field has a `name`, `type` (from the `FieldType` enum), and optional validators/taggers. Available field types include:
- Primitives: `STRING`, `NUMBER`, `INT`
- Content: `MARKDOWN`, `IMAGE`, `AUDIO`, `MIDI`
- Specialized: `CHESS_PUZZLE`, `MEDIA_UPLOADS`

**Example**: Single-digit addition
```typescript
{
  name: DataShapeName.MATH_SingleDigitAddition,
  fields: [
    { name: 'a', type: FieldType.INT },
    { name: 'b', type: FieldType.INT }
  ]
}
```

### 2. **Questions** - The Pedagogy Layer

The abstract `Question` class (extends `Displayable`) defines how to:
1. **Interpret** data into an interactive experience
2. **Validate** user responses
3. **Evaluate** demonstrated skill

```typescript
abstract class Question {
  static dataShapes: DataShape[];
  static views: ViewComponent[];

  protected abstract isCorrect(answer: Answer): boolean;
  protected displayedSkill(answer: Answer, timeSpent: number): number;
  public evaluate(answer: Answer, timeSpent: number): Evaluation;
}
```

Questions declare:
- Which `DataShapes` they can consume
- Which Vue components can render them
- How to assess correctness
- (Optionally) Sophisticated performance metrics

**Example**: The `SingleDigitAdditionQuestion` consumes data matching `SingleDigitAdditionDataShape` and can render via `HorizontalAddition.vue` or `VerbalAddition.vue` components.

### 3. **Views** - The Presentation Layer

Vue components that receive:
- A `Question` instance (with populated data)
- Props/events for user interaction

Views are **reusable** - a single view component can render many different question types that share a common interaction pattern (e.g., multiple-choice, fill-in-the-blank).

### 4. **Cards** - The Unit of Study

In the database, a card is metadata that references:
```typescript
interface CardData {
  id_displayable_data: DocumentId[];  // One or more data instances
  id_view: DocumentId;                // The view component ID
  elo: CourseElo;                     // Difficulty rating
  author: string;
  // ... (course, tags, etc.)
}
```

When hydrated for study, the system:
1. Fetches the referenced `DisplayableData` documents
2. Converts them to `ViewData` (plain objects with field values)
3. Instantiates the appropriate `Question` subclass
4. Renders the associated Vue component

## Key Design Advantages

### **Combinatorial Content Generation**

Cards reference data by ID rather than embedding it. This enables:
- **Reusable data**: One melody can appear in multiple keys
- **Atomic authoring**: Define `data1: [tonalMelody]` and `data2: [key]` separately
- **Exponential combinations**: N melodies × M keys = N×M cards without duplication

### **Compositional Questions**

Questions can:
- **Inherit** from base implementations (override `isCorrect()`, reuse `displayedSkill()`)
- **Compose** multiple sub-questions into compound assessments
- **Share views** across question types

The architecture supports cards containing instances of several questions, enabling compound assessments where failure in subcomponents can be analyzed independently.

### **Strongly Typed Pedagogy**

By declaring `dataShapes` statically:
- Type errors are caught at build time (TypeScript + Zod validation)
- The MCP server can enumerate all question types programmatically
- Backend services access `DataShapes` without importing Vue code (via `@vue-skuilder/courseware/backend`)

The `displayedSkill()` method enables nuanced performance tracking beyond binary correct/incorrect:
- Time penalties for slow responses
- Future: Multi-dimensional skill assessment
- Future: Typo detection vs. conceptual errors

### **Flexible Rendering**

A single `DataShape` can have multiple views:
- `SingleDigitAddition` ’ `HorizontalAddition.vue` (symbolic: "7 + 4 = ?")
- `SingleDigitAddition` ’ `VerbalAddition.vue` (natural language: "What is seven plus four?")

The system randomly selects views, providing varied presentation of the same content.

## Storage Architecture

**Normalized database**:
- `DISPLAYABLE_DATA` documents hold field values + attachments (audio, images)
- `CARD` documents reference data by ID
- `TAG` documents enable filtering and organization
- `CardHistory` tracks user performance over time

This separation enables:
- Efficient bulk imports (shared data, many cards)
- Git-based content provenance (via `sourceRef` in MCP tools)
- ELO-based adaptive difficulty

## Default Card Type: Fill-in-the-Blank

The `BlanksCard` (DataShape: `Blanks`) parses markdown with moustache syntax:
- `{{answer}}` ’ text input
- `{{answer1|answer2}}` ’ accepts multiple correct answers
- `{{answer||distractor1|distractor2}}` ’ multiple choice
- Full markdown support (code blocks, images, audio, embeds)

This provides a low-friction authoring experience while maintaining the typed data model underneath.

---

## Why This Matters

The card data model isn't just data plumbing - it's an **architecture for scalable educational content**. By separating data, logic, and presentation, Vue-Skuilder enables:

1. **Authors** to create rich, interactive content without writing code
2. **Developers** to extend the system with new question types
3. **AI agents** (via MCP) to generate well-formed content programmatically
4. **Researchers** to analyze learning patterns across question types

The strongly-typed approach means pedagogical relationships - like "mastering X implies partial mastery of Y" - can be encoded statically and reasoned about systematically, moving toward a future of formally verifiable educational content.
