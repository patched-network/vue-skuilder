<script setup>
import { ref } from 'vue'
import FallingLetters from '@vue-skuilder/courseware/typing/questions/falling-letters/FallingLetters.vue'

const showCard = ref(false)
const gameData = ref([
  { gameLength: 15, initialSpeed: 1, acceleration: 0.2, spawnInterval: 0.25 }
])
const lastResult = ref(null)

const handleResponse = (cardRecord) => {
  console.log(`handling: ${JSON.stringify(cardRecord)}`);
  lastResult.value = {
    isCorrect: cardRecord.isCorrect,
    performance: cardRecord.performance
  }
};

const toggleCard = () => {
  // Reset result when showing the card
  if (!showCard.value) {
    lastResult.value = null;
  }
  showCard.value = !showCard.value;
}
</script>

# Creating Custom Cards

This page shows how to add a custom card type to your app. Card types must adhere to a few interfaces and some lifecycle behaviour, but otherwise face very little constraint. Whatever might be in a Vue component can be rendered as a card.

## Illustrating Example: Saving the world from letter-asteroids

Here is a card implemented as a for-fun exercise in a typing course. Run the card, but consider cracking your knuckles first, or else taming the difficulty via playing with the parameters.

<div class="interactive-demo">
  <div class="demo-controls">
    <div class="control-group">
      <label for="gameLength">Game Length (s)</label>
      <input id="gameLength" type="number" v-model.number="gameData[0].gameLength">
    </div>
    <div class="control-group">
      <label for="initialSpeed">Initial Speed</label>
      <input id="initialSpeed" type="number" v-model.number="gameData[0].initialSpeed">
    </div>
    <div class="control-group">
      <label for="acceleration">Acceleration</label>
      <input id="acceleration" type="number" step="0.1" v-model.number="gameData[0].acceleration">
    </div>
    <div class="control-group">
      <label for="spawnInterval">Spawn Interval (s)</label>
      <input id="spawnInterval" type="number" step="0.1" v-model.number="gameData[0].spawnInterval">
    </div>
  </div>

  <button @click="toggleCard" class="vp-button vp-button-brand run-card-button">
    {{ showCard ? 'Reset the Card' : 'Run the Card' }}
  </button>
  <div v-if="showCard" class="demo-content">
    <FallingLetters :data="gameData" @emit-response="handleResponse" />
    <div v-if="lastResult" class="result-display">
      <p><strong>Card Emitted Result:</strong></p>
      <pre>{{ JSON.stringify(lastResult, null, 2) }}</pre>
    </div>
  </div>
</div>

<style>
.interactive-demo {
  background-color: var(--vp-c-bg-soft);
  padding: 1.5rem;
  border-radius: 8px;
  margin: 1.5rem 0;
}
.demo-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.control-group {
  display: flex;
  flex-direction: column;
}
.control-group label {
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: var(--vp-c-text-2);
}
.control-group input {
  font-size: 1rem;
  padding: 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--vp-c-border);
  background-color: var(--vp-c-bg);
  width: 100%;
}
.demo-content {
  margin-top: 1.5rem;
}

.run-card-button {
  /* Base styles to ensure it looks like a button */
  display: inline-block;
  border: 2px solid var(--vp-button-brand-border);
  color: var(--vp-button-brand-text);
  background-color: var(--vp-button-brand-bg);
  border-radius: 20px;
  text-decoration: none !important; /* Ensure no underline */
  text-align: center;

  /* "Poppy" styles */
  padding: 0.5rem 1.5rem;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
  transition: all 0.2s ease-out;
}

.run-card-button:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  background-color: var(--vp-button-brand-hover-bg);
  border-color: var(--vp-button-brand-hover-border);
  color: var(--vp-button-brand-hover-text);
}

.result-display {
  margin-top: 1.5rem;
  padding: 1rem;
  background-color: var(--vp-c-bg);
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
}

.result-display p {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  color: var(--vp-c-text-2);
}

.result-display pre {
  background-color: var(--vp-c-bg-alt);
  padding: 1rem;
  border-radius: 4px;
  font-family: var(--vp-font-family-mono);
  font-size: 0.875rem;
  color: var(--vp-c-text-1);
  white-space: pre-wrap;
}
</style>

## How It Works: The Core Concepts

The game you just played is a standard Vue component, hosted within the platform's card system. Three pieces make that possible:

-   **The `DataShape`**: a schema for the card's data. For the game above, it declares `gameLength`, `initialSpeed`, `acceleration` and `spawnInterval`. Every card of this type is one set of those values.

-   **The `Question`**: a TypeScript class that holds the card's data and decides how a response is graded: whether it counts as correct (for scheduling) and how well it went (for ratings).

-   **The `View`**: the Vue component itself (`FallingLetters.vue`). It renders, runs its own game loop, and submits an answer when it's done.

The source is in `packages/courseware/src/typing/questions/falling-letters/`.

> The platform does not care what happens inside the view. It cares about two moments: the view
> receives data, and the view submits an answer. Everything between is yours.

## The Falling Letters Card, Piece by Piece

### 1. The data

```typescript
export class FallingLettersQuestion extends Question {
  public static dataShapes: DataShape[] = [
    {
      name: DataShapeName.TYPING_fallingLetters,
      fields: [
        { name: 'gameLength', type: FieldType.NUMBER },
        { name: 'initialSpeed', type: FieldType.NUMBER },
        { name: 'acceleration', type: FieldType.NUMBER },
        { name: 'spawnInterval', type: FieldType.NUMBER /* validator: must be > 0 */ },
      ],
    },
  ];
```

Fields can carry validators, which authoring tools use to check input. The shape is registered in
the course configuration, where it also becomes a JSON schema (the MCP server hands that schema to
agents).

### 2. The grading

```typescript
  constructor(data: ViewData[]) {
    super(data);
    this.gameLength = data[0].gameLength as number;
    // ...
  }

  isCorrect(a: Score) {
    return a.win;                          // SRS: survived the whole game?
  }

  displayedSkill(a: Score) {
    return a.win ? 1 : a.percentage;       // ELO: how far you got
  }
}
```

`isCorrect` drives spaced repetition (extend or reset the interval). `displayedSkill` drives
ratings, on a 0-1 scale. For richer grading, override `evaluate()` and return:

- a **per-tag** performance, such as `{ _global: 0.8, 'letters:home-row': 1, 'letters:top-row': 0.4 }`,
  so each skill the card exercises is rated on its own;
- `fluent: false` for an answer that was right but too slow, so the card comes back sooner;
- `deferAdvance: true` to record the answer now but stay on the card (say, for an animation) until
  the view emits `ready-to-advance`.

### 3. The view

```vue
<script lang="ts">
import { useViewable, useQuestionView } from '@vue-skuilder/common-ui';

export default defineComponent({
  name: 'FallingLettersView',
  props: { data: { type: Array as PropType<ViewData[]>, required: true } },
  emits: ['emitResponse'],
  setup(props, { emit }) {
    const viewableUtils = useViewable(props, emit, 'FallingLettersView');
    const questionUtils = useQuestionView<FallingLettersQuestion>(viewableUtils);
    questionUtils.question.value = new FallingLettersQuestion(props.data);

    // ... game loop, rendering, keyboard handling ...

    const win = () => questionUtils.submitAnswer({ win: true, lettersTyped: score.value, percentage: 1 });
  },
});
</script>
```

`useViewable` times the card and wires the response event. `useQuestionView` holds the question
instance; `submitAnswer` evaluates the answer, packages it as a record, and hands it to the session.
The session then writes history, updates ratings, schedules a review, and moves on.

The component's `name` matters: it is part of the view ID stored on each card
(`{courseware}.question.{QuestionClass}.{ViewName}`), so keep it stable once cards exist.

## Adding a Card Type to Your Project

A project from `skuilder init` already contains three example card types in `src/questions/`
(`SimpleTextQuestion`, `MultipleChoiceQuestion`, `NumberRangeQuestion`). Copy one as a starting point.

```
src/questions/
├── MyCardQuestion.ts          # DataShape + Question
├── MyCardQuestionView.vue     # the view
├── exampleCourse.ts           # groups your question types into a CourseWare
└── index.ts                   # library entry: exports everything for studio mode
```

**1. Write the question and view**, following the pattern above. Register the view on the class:

```typescript
public static views = [markRaw(MyCardQuestionView)];
```

**2. Add the question to your courseware** in `exampleCourse.ts`:

```typescript
import { CourseWare } from '@vue-skuilder/courseware';

export const exampleCourse = new CourseWare('ExampleCourse', [
  SimpleTextQuestion,
  MultipleChoiceQuestion,
  NumberRangeQuestion,
  MyCardQuestion,
]);
```

`src/main.ts` adds this courseware to the `allCourseWare` registry at startup, which is how the
study session finds your views.

**3. Export it for studio** in `src/questions/index.ts`: add the class to `allCustomQuestions()`
and re-export the class and view. `npm run studio` then builds your card types into the editor, so
you can create cards of the new type there.

::: tip Name your courseware
The scaffold names its courseware `ExampleCourse`, and that name becomes part of every card's view
ID. Rename it to something unique to your project before you author real content; renaming later
means rewriting the view IDs on existing cards.
:::

## Where to Go Next

- A card type can bring its own content: `static seedData` (and `seedMeta` for tags and starting
  ELO) creates cards when the type is registered with a course. The math card types in
  `packages/courseware/src/math/` do this.
- If you only need a custom widget inside otherwise-markdown cards, an
  [inline component](./inline-components) is lighter than a full card type.
- If your card type should influence *which* cards come next (for example, an introduction that
  should be followed by practice), see [Navigation Strategies](./navigation-strategies) and session
  hints.

The key takeaway: a card's view is a standard Vue component, giving you complete creative control.
The `Question` class is the bridge that integrates your component into the platform's learning and
evaluation lifecycle.
