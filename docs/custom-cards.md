<script setup>
import { ref } from 'vue'
import FallingLetters from '@vue-skuilder/courseware/typing/questions/falling-letters/FallingLetters.vue'

const showCard = ref(false)
const gameData = ref([
  { gameLength: 30, initialSpeed: 1, acceleration: 0.2, spawnInterval: 1 }
])
</script>

# Creating Custom Interactive Cards

You've scaffolded a new course with the CLI. Now for the fun part: building custom, interactive learning experiences that go beyond simple multiple-choice or text-input questions.

This guide will show you how the platform is designed to host rich Vue components as cards, giving you the freedom to build almost anything.

## See It in Action: A Mini-Game Card

A card can be a simple quiz, but it can also be a game. Click the button below to run the "Falling Letters" game, built as a custom card. Try to type the letters before they reach the bottom!

<div class="interactive-demo">
  <button @click="showCard = !showCard" class="vp-button vp-button-brand">
    {{ showCard ? 'Hide Card' : 'Run the Card' }}
  </button>
  <div v-if="showCard" class="demo-content">
    <FallingLetters :data="gameData" />
  </div>
</div>

<style>
.interactive-demo {
  background-color: var(--vp-c-bg-soft);
  padding: 1.5rem;
  border-radius: 8px;
  margin: 1.5rem 0;
}
.demo-content {
  margin-top: 1.5rem;
}
</style>

## How It Works: The Core Concepts

The game you just played is a standard Vue component, hosted within the platform's card system. This is made possible by three core concepts:

-   **The `View`**: The interactive component itself (e.g., `SimpleFallingLetters.vue`). This is where you build your UI and user experience.

-   **The `Question`**: A TypeScript class that acts as the "brain" for the card. It defines the card's logic, how to evaluate answers, and what data it needs.

-   **The `DataShape`**: A schema that defines the data structure for your card. For the game above, its `DataShape` defines properties like `gameLength` and `initialSpeed`.

## Building the "Falling Letters" Card: A High-Level Look

Here’s a brief overview of how the card you just saw is put together. You'll follow these same steps when creating your own cards in the project you scaffolded with the CLI.

### 1. Defining the Data (`src/questions/simple-falling-letters/shapes.ts`)

First, you define the configurable parameters for your card.

```typescript
// This would go in your scaffolded project
import { DataShape, FieldType, DataShapeName } from '@vue-skuilder/common';

export const FallingLettersShape: DataShape = {
  name: DataShapeName.TYPING_fallingLetters, // A unique name
  fields: [
    { name: 'gameLength', type: FieldType.NUMBER },
    { name: 'initialSpeed', type: FieldType.NUMBER },
    { name: 'spawnInterval', type: FieldType.NUMBER },
  ],
};
```

### 2. Creating the Logic (`src/questions/simple-falling-letters/index.ts`)

Next, you create the `Question` class that ties everything together.

```typescript
import { Question } from '@vue-skuilder/common-ui';
// ... other imports

export class FallingLettersQuestion extends Question {
  // ... implementation ...
}
```

### 3. Building the View (`src/questions/simple-falling-letters/view.vue`)

This is the Vue component with the game's UI and logic, just like the one embedded at the top of this page.

### 4. Registering Your Card (`src/questions/index.ts`)

Finally, you make your new card type available to the application by adding it to your course's main question list.

```typescript
// In your scaffolded src/questions/index.ts
import { CourseWare } from '@vue-skuilder/courseware';
import { FallingLettersQuestion } from './falling-letters';

// Add your new question to the list
const myCourse = new CourseWare('my-course', [FallingLettersQuestion]);

export default myCourse;
```

## Next Steps

You're now ready to build your own custom cards. The key takeaway is that a card's `View` is a standard Vue component, giving you complete creative control. The `Question` class is the bridge that integrates your component into the platform's learning and evaluation lifecycle.
