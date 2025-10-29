<script setup lang="ts">
import EmbeddedFillInEditor from '../.vitepress/theme/components/EmbeddedFillInEditor.vue'
import { markRaw, h } from 'vue';
import ChessBoard from '@vue-skuilder/courseware/chess/components/ChessBoard.vue';

// Simple badge component
const Badge = {
  name: 'Badge',
  render() {
    return h('span', {
      style: 'background: #42b983; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; font-weight: 600;'
    }, 'NEW');
  }
};

// Component that accepts a color prop
const ColoredBadge = {
  name: 'ColoredBadge',
  props: ['color', 'text'],
  render() {
    return h('span', {
      style: `background: ${this.color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; font-weight: 600;`
    }, this.text || 'BADGE');
  }
};

// Wrapper component for ChessBoard that converts string FEN prop to position object
const ChessPosition = {
  name: 'ChessPosition',
  props: ['fen', 'size'],
  components: { ChessBoard },
  render() {
    const position = {
      fen: this.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
      orientation: 'white',
    };

    const containerStyle = this.size === 'large'
      ? 'width: 400px; height: 400px;'
      : 'width: 250px; height: 250px;';

    return h('div', { style: `display: inline-block; ${containerStyle}` }, [
      h(ChessBoard, {
        position,
        showCoordinates: false,
        config: { movable: { free: false } }
      })
    ]);
  }
};

// Provide components for the embedded editors
const inlineComponents = {
  badge: markRaw(Badge),
  coloredBadge: markRaw(ColoredBadge),
  chessPosition: markRaw(ChessPosition),
};

// Example markdown strings
const badgeExample = `Check out this {{ <badge /> }} feature!`;

const coloredBadgeExample = `Status: {{ <coloredBadge color="#e74c3c" text="ALERT" /> }}

Priority: {{ <coloredBadge color="#3498db" text="HIGH" /> }}`;

const chessExample = `White to move. What's the best continuation?

{{ <chessPosition fen="r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R" /> }}

The answer is {{ Nxe5 }}.`;

const chessSizesExample = `Small board:
{{ <chessPosition fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR" size="small" /> }}

Large board:
{{ <chessPosition fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR" size="large" /> }}`;
</script>

# Inline Components

Embed custom Vue components directly into your markdown card content using <span v-pre>`{{ <component-name /> }}`</span> syntax. This is a middle ground between basic fill-in syntax and fully [custom cards](/extend/custom-cards).

## Basic Example

The simplest inline component takes no parameters:

<EmbeddedFillInEditor :initial-value="badgeExample" :inline-components="inlineComponents" />

Here, `badge` is a Vue component that renders a styled span. The syntax <span v-pre>`{{ <badge /> }}`</span> tells the markdown renderer to insert the component inline.

## Components with Data

Pass data to components using attributes:

<EmbeddedFillInEditor
  :initial-value="coloredBadgeExample"
  :inline-components="inlineComponents"
/>

The `color` and `text` attributes become props on the Vue component. This lets you reuse the same component with different data across many cards.

## Real-World Example: Chess Positions

A chess position component that accepts FEN notation:

<EmbeddedFillInEditor
  :initial-value="chessExample"
  :inline-components="inlineComponents"
/>

Notice how the chess component and fill-in blank <span v-pre>`{{ Nxe5 }}`</span> coexist in the same card. Multiple props work too:

<EmbeddedFillInEditor
  :initial-value="chessSizesExample"
  :inline-components="inlineComponents"
/>

## Setting Up Components

Register components when bootstrapping your Vue app (in `src/main.ts`):

```typescript
import { markRaw } from 'vue';
import Badge from './components/Badge.vue';
import ChessPosition from './components/ChessPosition.vue';

app.provide('markdownComponents', {
  badge: markRaw(Badge),
  chessPosition: markRaw(ChessPosition),
});
```

::: tip Why markRaw()?
Use `markRaw()` for performance - it prevents Vue from making components reactive, which isn't needed here.
:::

Components can be defined inline (like in this page's examples) or imported from `.vue` files. The markdown syntax stays the same either way.

## Interactive Components (Grading)

Components can participate in answer evaluation by extending `BaseUserInput`:

```vue
<script lang="ts">
import BaseUserInput from '@vue-skuilder/common-ui/components/studentInputs/BaseUserInput';

export default {
  extends: BaseUserInput,
  props: ['expectedAnswer'],
  methods: {
    handleSubmit(value) {
      // When user provides answer, submit for grading
      this.submit({ userValue: value });
    }
  }
}
</script>
```

**How grading works:**
1. Component calls `this.submit(answer)` with user's response
2. BaseUserInput walks up the component tree to find QuestionView ancestor
3. QuestionView calls `Question.evaluate(answer, timeSpent)`
4. Returns `Evaluation: { isCorrect: boolean, performance: number (0-1) }`

See the fill-in implementation for a complete example:
- Component: `packages/common-ui/src/components/studentInputs/fillInInput.vue`
- Question class: `packages/courseware/src/default/questions/fillIn/index.ts`

**Key types** (from `@vue-skuilder/common`):
- `Answer` - Base interface for user responses
- `Evaluation` - `{ isCorrect: boolean, performance: number }`

**Key classes** (from `@vue-skuilder/common-ui`):
- `BaseUserInput` - Base component with `submit()` method
- `Question` - Abstract class with `isCorrect()` and `evaluate()` methods

## When to Use What?

- **<span v-pre>`{{ }}`</span> fill-in syntax** → Simple text input or multiple choice
- **Inline components** (this page) → Custom UI reused across many cards
- **[Full custom cards](/extend/custom-cards)** → Complete control over card logic, data model, and views
