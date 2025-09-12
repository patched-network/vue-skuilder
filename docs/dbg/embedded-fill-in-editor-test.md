# EmbeddedFillInEditor Component Test

Test page for EmbeddedFillInEditor component development and debugging.

<script setup lang="ts">
import EmbeddedFillInEditor from '../.vitepress/theme/components/EmbeddedFillInEditor.vue'

// Define complex examples to avoid attribute escaping issues
const atmosphereExample = "The main gas found in Earth's atmosphere is {{Nitrogen||Oxygen|Carbon Dioxide|Hydrogen|Methane}}."
const codeExample = `Given the JavaScript code:

\`\`\`javascript
const items = [1, 2, 3, 4, 5];
const doubled = items.map(x => x * 2);
\`\`\`

The \`map\` method {{returns a new array||modifies the original array|returns undefined|throws an error}}.`
</script>

## Basic Fill-In Example

Simple fill-in-the-blank with a single correct answer:

<EmbeddedFillInEditor initial-value="The capital of France is {{Paris}}." />

## Multiple Alternatives Example

Fill-in with multiple acceptable answers:

<EmbeddedFillInEditor initial-value="JavaScript variables can be declared with {{let|var}}." />

## Multiple Choice Example

Multiple choice with correct answer and distractors:

<EmbeddedFillInEditor :initial-value="atmosphereExample" />

## Programming Example

Code-related fill-in question:

<EmbeddedFillInEditor initial-value="In Go, the operator used to send a value to a channel is {{<-||->|<<|>>|:=}}." />

## Complex Example with Context

Fill-in with markdown context and code:

<EmbeddedFillInEditor :initial-value="codeExample" />

## Progressive Difficulty Examples

### Easy Version
<EmbeddedFillInEditor initial-value="A cat is a type of {{animal||plant}}." />

### Medium Version  
<EmbeddedFillInEditor initial-value="A cat is a type of {{animal||mammal|pet}}." />

### Hard Version
<EmbeddedFillInEditor initial-value="A cat is a type of {{animal||mammal|feline|carnivore|vertebrate}}." />

## Syntax Testing Area

Use this editor to test different mustache syntax patterns:

<EmbeddedFillInEditor initial-value="Edit this text to test different {{syntax||patterns|examples}}!" />

---

## Syntax Reference

The editor supports these mustache patterns:

- **Simple fill-in**: `{{answer}}`
- **Multiple alternatives**: `{{answer1|answer2}}`  
- **Multiple choice**: `{{correct||distractor1|distractor2}}`
- **Progressive difficulty**: Add more distractors to increase difficulty

Try editing the examples above to see how different syntax patterns render!