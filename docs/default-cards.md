# Default Cards Reference

The default card type is `BlanksCard`, in the built-in `default` courseware. It renders markdown
with a moustache syntax for blanks. [The Default Card Type](./learn/cards) explains it with live
editors; this page is the compact reference.

## Identity

| | |
|---|---|
| Courseware | `default` (`defaultCourse` in `@vue-skuilder/courseware`) |
| Question class | `BlanksCard` |
| Data shape | `default.datashape.Blanks` |
| View ID | `default.question.BlanksCard.FillInView` |
| Fields | `Input` (markdown), `Uploads` (media, optional) |

Apps must register it before rendering such cards:

```ts
import { allCourseWare, defaultCourse } from '@vue-skuilder/courseware';
allCourseWare.courses.push(defaultCourse);
```

## Syntax

| You write | The card shows | Correct when |
|---|---|---|
| plain markdown, no braces | the text and a *next* button | always (dismissal is recorded as correct) |
| <code v-pre>The capital of France is {{Paris}}.</code> | a text input | the typed answer equals `Paris` exactly |
| <code v-pre>{{Nitrogen&#124;&#124;Oxygen&#124;Helium}}</code> | a multiple-choice blank | `Nitrogen` is chosen |
| <code v-pre>{{A&#124;B&#124;&#124;C&#124;D}}</code> | multiple choice showing one of `A`/`B`, plus `C`, `D` | the shown correct option is chosen |
| a final line holding only <code v-pre>{{yes&#124;&#124;no}}</code> | the options, with no blank inserted in the text | the correct option is chosen |
| <code v-pre>{{ &lt;badge /&gt; }}</code> | an [inline component](./extend/inline-components) | (not graded unless the component submits) |

## Rules

- `||` separates correct answers (left) from distractors (right). `|` separates siblings on either
  side.
- At most 6 options are shown, in random order, with exactly one correct option among them. When
  more are supplied and the card is rated well above the learner, fewer distractors are shown (one
  distractor once the gap passes 200 points).
- An item listed as both answer and distractor is treated as an answer only.
- Whitespace inside the braces is trimmed, so blanks can span lines.
- Options may contain markdown, including code blocks.
- Without `||`, the whole content is a single typed answer: <code v-pre>{{Paris|paris}}</code> expects the
  literal text `Paris|paris`. Alternative typed answers are not supported yet.
- Media: images and audio attached through the `Uploads` field render in the card. Arbitrary HTML
  embeds (for example, a video iframe) are passed through.

## Scheduling and grading

- Correctness drives SRS; the default performance score is correctness with a penalty for slow
  answers.
- A card tagged `srs:skip` is shown once and never scheduled for review.

## Other built-in card types

The `@vue-skuilder/courseware` package also ships example card types, loaded on demand with
`loadSubcourse(name)` or `loadAllSubcourses()`: `chess`, `french`, `math`, `piano`, `pitch`,
`sightSing`, `typing`, `wordWork`. They are worked examples for [custom cards](./extend/custom-cards)
more than finished products.
