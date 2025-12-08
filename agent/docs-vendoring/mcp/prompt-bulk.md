## Guide for Authoring Bulk Flashcard Content (`fillIn` Type)

This guide explains how to format plain text for bulk import of flashcards. The system processes this text to create individual flashcards with questions, answers, and tags. Each card will be of the "fill-in-the-blank" or "multiple choice" style.

**General Format Rules:**

1.  **Card Separation**:
    *   Each card's content must be separated from the next by **two consecutive lines, each containing exactly three hyphens (`---`)**.
    *   Example:
        ```text
        Content for Card 1...
        tags: example
        ---
        ---
        Content for Card 2...
        ```

2.  **Tags and ELO Metadata**:
    *   Tags are optional.
    *   Tags do not contain spaces, but can use dots or hyphens.
    *   If included, they **must** be on one of the **last lines** of a card's content block (before the `---` separator).
    *   The line must start with `tags:` (case-insensitive) followed by a comma-separated list of tags.
    *   Example: `tags: javascript, programming, web-development`
    *   If this line is omitted, the card will have no tags.
    *   You can also include an ELO rating by adding a line with `elo: [integer]` (case-insensitive).
    *   The ELO rating indicates difficulty level, using a chess-like rating scale:
        * 100-500: Beginner level, basic knowledge
        * 500-1000: Some knowledge, early understanding
        * 1000-1500: Intermediate knowledge
        * 1500-2000: Advanced understanding
        * 2000-2400: Expert level
        * 2400+: Elite/master level
    *   Example: `elo: 1250` or `tags: go, functions` followed by `elo: 850`

3.  **Plain Text Only**:
    *   The bulk input is for plain text markdown content only. Do not attempt to include or reference image/audio uploads directly in this bulk format.

**Content Formatting for `fillIn` Questions:**

The main content of your card is markdown. Special interactive elements (blanks or multiple-choice options) are defined using double curly braces: `{{ ... }}`. The content inside the curly braces can also contain markdown formatting, including code blocks.

1.  **Basic Fill-in-the-Blank (Single Answer)**:
    *   Use `{{answer}}` where the blank should appear in your question.
    *   The text inside the `{{ }}` is the exact expected answer.
    *   **Example Card**:
        ```text
        The capital of France is {{Paris}}.
        tags: geography, europe
        ```

2.  **Fill-in-the-Blank (Multiple Accepted Answers)**:
    *   If multiple text inputs are acceptable for a single blank, separate them with a pipe `|` character inside the `{{ }}`.
    *   The user only needs to type one of these to be correct.
    *   **Example Card**:
        ```text
        A common way to declare a variable in JavaScript that can be reassigned is using the {{let|var}} keyword.
        tags: javascript, programming
        ```
        *(Here, both "let" and "var" would be accepted as correct for the blank).*

3.  **Multiple Choice Questions (Radio Buttons)**:
    *   This format also uses the `{{ ... }}` syntax but with a specific internal structure to define correct answers and distractors.
    *   The structure is: `{{correct_answer1|correct_answer2||distractor1|distractor2}}`
        *   **Correct Answers**: List one or more correct answers first, separated by `|`.
        *   **Separator**: Use a double pipe `||` to separate the list of correct answers from the list of distractors.
        *   **Distractors**: List one or more incorrect answers (distractors) after the `||`, separated by `|`.
    *   The system will automatically create a multiple-choice question. It will pick *one* of your specified correct answers and display it along with *all* the specified distractors, shuffled, as radio button options.
    *   **Example Card**:
        ```text
        Which of the following is a primary color?
        {{Red|Blue|Yellow||Green|Orange|Purple}}
        tags: art, colors, multiple choice
        ```
        *(In this example, "Red", "Blue", and "Yellow" are all correct. The system might generate a question with choices like "Blue", "Green", "Orange", "Purple" (shuffled). If the user selects "Blue", they are correct.)*

    *   **Example Card (Single Correct Answer for Multiple Choice)**:
        ```text
        What is the main gas found in the air we breathe?
        {{Nitrogen||Oxygen|Carbon Dioxide|Hydrogen}}
        tags: science, chemistry, atmosphere
        ```
        *(Here, only "Nitrogen" is correct. The choices presented would be "Nitrogen", "Oxygen", "Carbon Dioxide", "Hydrogen" (shuffled).)*

**Summary of `{{ ... }}` Syntax:**

*   `{{answer}}`: Simple blank, one correct string (can include markdown).
*   `{{ans1|ans2}}`: Simple blank, multiple accepted strings (user types one).
*   `{{correctAns1|correctAns2||distractor1|distractor2}}`: Multiple choice. One of the `correctAns` will be shown with all `distractors`.
*   All answers can contain markdown, including code blocks, lists, and other formatting.

**Complete Example of a Small Bulk Input:**

```text
What is the chemical symbol for water?
{{H2O|HOH}}
tags: chemistry, science
elo: 500

---
---

Which planet is known as the Red Planet?
{{Mars||Jupiter|Saturn|Venus}}
tags: astronomy, solar system, multiple choice
elo: 750

---
---

The `typeof` operator in JavaScript returns a ____ indicating the type of the unevaluated operand.
{{string}}
elo: 1250
tags: javascript, programming, operators
```

**Tips for Authors:**

*   **Clarity is Key**: Ensure your questions are clear and the blanks/choices are unambiguous.
*   **Markdown**: Standard markdown can be used for formatting the question text (e.g., bold, italics, lists), but keep it simple.
*   **Code Blocks in Questions**: Do not use the `{{ ... }}` syntax inside code blocks (```). If you need to indicate a blank in code, place the `{{ ... }}` outside the code block and make it clear what should be filled in.
*   **Code Examples in Questions**: It can be very useful to include code blocks in the main body of your question, then ask about that code. For example:
        ```go
        func main() {
            x := 10
            fmt.Println(x)
        }
        ```
        The above program will {{compile and run correctly||fail at compilation|fail at runtime}}
*   **Code Blocks in Answers**: Code blocks ARE allowed inside the `{{ ... }}` syntax as part of the answer. For example:

        {{```go
        func main() {
            fmt.Println("Hello")
        }
        ```}}
*   **Keep Answers Concise**: Avoid very long answers in fill-in-the-blank questions. Long answers have high entropy, making it difficult for users to match the expected answer even if they understand the concept. Prefer short, specific answers (1-3 words is ideal) or use multiple-choice for complex answers.
*   **Review `{{ ... }}` Carefully**: Typos within the `{{ }}` syntax, especially with the `|` and `||` separators, can lead to incorrect parsing.
*   **Test Small Batches**: If you're unsure, try importing a small batch of 2-3 cards first to verify they are parsed as expected.
