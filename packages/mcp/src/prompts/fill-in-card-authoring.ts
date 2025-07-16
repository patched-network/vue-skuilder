/* eslint-disable max-len */
export function createFillInCardAuthoringPrompt(): string {
  return `# GUIDE: Authoring "fillIn" type Flashcards

This guide provides the technical specifications for authoring a "fillIn" type flashcard for the Vue-Skuilder platform. When you need to create a new card, you should use the 'create_card' tool and format the content as described below.

## 1. Tool: 'create_card'

You should call the 'create_card' tool with the following parameters:

- 'datashape': Must be 'fillIn'.
- 'data': A markdown string containing the question and the interactive '{{...}}' elements.
- 'tags': (Optional) An array of strings for tagging, e.g., ['go', 'concurrency'].
- 'elo': (Optional) An integer representing the estimated difficulty (e.g., 1250).

**IMPORTANT**: Do NOT include 'tags:' or 'elo:' information inside the 'data' string itself. These are tool parameters.

## 2. Content Formatting ('data' parameter)

The 'data' string is composed of a question and special interactive elements using '{{...}}' syntax.

### A. Simple Fill-in-the-Blank
- For a single correct answer.
- **Syntax**: '{{answer}}'
- **Example**: 'The capital of France is {{Paris}}.'

### B. Fill-in-the-Blank with Alternatives
- For when multiple text inputs are acceptable for the same blank.
- **Syntax**: '{{answer1|answer2}}'
- **Example**: 'A common way to declare a variable in JavaScript that can be reassigned is using the {{let|var}} keyword.'

### C. Multiple Choice
- For presenting a question with several options.
- **Syntax**: '{{correct_answer1|correct_answer2||distractor1|distractor2|distractor3|...}}'
- **Details**:
    - List one or more correct answers first, separated by '|'.
    - Use a double pipe '||' to separate correct answers from distractors.
    - List one or more incorrect answers (distractors) after the '||', separated by '|'.
    - **Many distractors can be added** - the rendering layer will limit runtime display to a maximum of 5 rendered distractors.
    - **Front-load the most relevant distractors** - they will be weighted more favorably in selection.
- **Example (Single Correct)**: 'What is the main gas found in the air we breathe? {{Nitrogen||Oxygen|Carbon Dioxide|Hydrogen}}'
- **Example (Multiple Correct)**: 'Which of the following are primary colors? {{Red|Blue|Yellow||Green|Orange|Purple}}' (The system will pick one correct answer to display with the distractors).
- **Example (Many Distractors)**: 'Which letter comes after M in the alphabet? {{N||O|L|P|Q|R|S|T|U|V|W|X|Y|Z|A|B|C|D|E|F|G|H|I|J|K}}' (Only 5 distractors will be shown, with O and L being most likely due to their position).

### D. Overlapping Cards for Difficulty Scaling
- **It is normal and advisable** to present the same content in overlapping cards with different distractor sets to scale difficulty.
- **Progressive difficulty**: Start with dissimilar distractors, then increase similarity to make the question harder.
- **Examples (Spelling/Phonics)**: Given an image of a car:
    - **Easy**: 'What word matches this image? {{car||airplane}}' (very different options)
    - **Medium**: 'What word matches this image? {{car||cat}}' (similar sounds)
    - **Hard**: 'What word matches this image? {{car||care}}' (very similar spelling)
    - **Harder**: 'What word matches this image? {{car||care|cat|far}}' (multiple similar options)
- **Benefits**: This approach allows learners to build confidence with easier versions before tackling more challenging variants of the same concept.

## 3. Best Practices & Tips

- **Clarity is Key**: Ensure your questions are clear and the blanks/choices are unambiguous.
- **Keep Answers Concise**: For fill-in-the-blanks, prefer short, specific answers (1-3 words is ideal). Long answers are hard for users to match. Use multiple-choice for more complex answers.
- **Code in Questions**: You can and should use markdown code blocks in the question body for context.
    - **Example**:
        Given the code:
        \`\`\`go
        func main() {
            x := 10
            fmt.Println(x)
        }
        \`\`\`
        The above program will {{compile and run correctly||fail at compilation|fail at runtime}}.
- **Code in Answers**: Code blocks ARE allowed inside the '{{...}}' syntax.
    - **Example**: '{{\`go\\nfunc main() {\\n    fmt.Println("Hello")\\n}\\n\`}}'
- **CRITICAL**: Do NOT place the '{{...}}' syntax inside a markdown code block (e.g., \`\`\` ... {{...}} ... \`\`\`). The interactive element must be outside of any code fences.
- **Review Syntax**: Carefully check your use of '|' and '||' in multiple-choice questions to avoid parsing errors.

## 4. Example Agent Workflow

This is an example of how an agent might use this guide.

**User Request:** "Make a card about Go channels."

**Agent's Thought Process:**
1.  I need to create a "fillIn" card about Go channels.
2.  A good multiple-choice question would be about the operator used to send a value to a channel.
3.  The question will be: "In Go, what operator is used to send a value to a channel?"
4.  The correct answer is '<-'. Some good distractors would be '->', '<<', and '>>'.
5.  The 'data' string for the tool call will be: 'In Go, what operator is used to send a value to a channel? {{<-||->|<<|>>}}'
6.  I'll tag it with 'go' and 'channels'.
7.  This is a fundamental concept, so I'll give it an ELO of 1100.
8.  Now I will call the 'create_card' tool with these parameters.

**Resulting Tool Call:**
<tool_code>
print(default_api.create_card(
  datashape='fillIn',
  data='In Go, what operator is used to send a value to a channel? {{<-||->|<<|>>}}',
  tags=['go', 'channels'],
  elo=1100
))
</tool_code>`;
}
