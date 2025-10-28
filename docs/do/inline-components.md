# Inline Components

A middle ground between basic card syntax and fully custom cards.

## What Are Inline Components?

<!--Inline components let you embed custom Vue components directly into your markdown card content using the syntax `{{ &lt;component-name /&gt; }}`. This is useful when you need richer interactivity than the default `{{ }}` fill-in syntax provides, but don't want to create a full custom card type.-->

## Two Types of Inline Components


### Display-Only Components

Simple visual elements that don't participate in grading:

``` ts
// In src/main.ts
import { markRaw } from 'vue';
import ChessBoard from './components/ChessBoard.vue';

app.provide('markdownComponents', {
  chessBoard: markRaw(ChessBoard),
});
```

Use in markdown:
```markdown
White to move. What's the best continuation?

{{ <chessBoard /> }}

{{ Qxf7+ }}
```

### Interactive Components (Grading)

Components that accept user input and participate in answer evaluation:

**Your component:**
```vue
<script lang="ts">;
import BaseUserInput from '@vue-skuilder/common-ui/components/studentInputs/BaseUserInput';

export default {
  extends: BaseUserInput,
  methods: {
    handleInput(value) {
      // When user provides answer, submit it for grading
      this.submit({ userValue: value });
    }
  }
}
</script>;
```

**Card Question class:**
```typescript
import { Question } from '@vue-skuilder/common-ui';
import { Answer } from '@vue-skuilder/common';

export class MyCard extends Question {
  protected isCorrect(answer: Answer): boolean {
    // Evaluate the answer
    return answer.userValue === this.expectedValue;
  }
}
```

**How it works:**
1. Component extends `BaseUserInput` and calls `this.submit(answer)`
2. BaseUserInput walks up the component tree to find the QuestionView ancestor
3. QuestionView calls `Question.evaluate(answer, timeSpent)`
4. Returns `Evaluation: { isCorrect: boolean, performance: number }`

## Registration

Register components where you bootstrap your Vue app:

**Platform UI** (`packages/platform-ui/src/main.ts`):
```typescript
import { markRaw } from 'vue';
import MyComponent from './components/MyComponent.vue';

app.provide('markdownComponents', {
  myComponent: markRaw(MyComponent),
});
```

**Standalone UI** (`packages/standalone-ui/src/main.ts`):
```typescript
// Same pattern
app.provide('markdownComponents', {
  myComponent: markRaw(MyComponent),
});
```

::: tip Why markRaw()?
Use `markRaw()` for performance optimization - it prevents Vue from making the component reactive, which isn't needed here.
:::

## Key Types and Classes

From `@vue-skuilder/common`:
- **`Answer`** - Base interface for user responses
- **`Evaluation`** - `{ isCorrect: boolean, performance: number }` (0-1)

From `@vue-skuilder/common-ui`:
- **`BaseUserInput`** - Base component with `submit(answer)` method
- **`Question`** - Abstract class with `isCorrect()` and `evaluate()` methods

## Reference Implementation

See the default fill-in components for a complete example:
- Component: `packages/common-ui/src/components/studentInputs/fillInInput.vue`
- Question: `packages/courseware/src/default/questions/fillIn/index.ts` (`BlanksCard` class)

## When to Use What?

- **Basic `{{ }}` syntax** - Simple text input or multiple choice
- **Inline components** (this page) - Custom UI within markdown, shared across many cards
- **[Full custom cards](/do/custom-cards)** - Complete control over card logic, data model, and views
