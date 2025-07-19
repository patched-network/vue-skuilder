// Node.js compatible business logic extracted from vue-skuilder/courses
// Contains essential fill-in-blank question parsing and grading logic

// ===== UTILITY FUNCTIONS =====

/**
 // [ ] Todo: deduplicate this code.


 * Utility to split text by left and right delimiters (e.g., {{ and }})
 * Extracted from packages/common-ui/src/components/cardRendering/MarkdownRendererHelpers.ts
 */
function splitByDelimiters(text, leftDelim, rightDelim) {
  const result = [];

  let remaining = text;

  while (remaining.includes(leftDelim)) {
    const leftIndex = remaining.indexOf(leftDelim);
    const rightIndex = remaining.indexOf(rightDelim, leftIndex + leftDelim.length);

    if (rightIndex === -1) {
      // No closing delimiter found, treat rest as plain text
      if (remaining.length > 0) {
        result.push({ beforeMatch: remaining, match: '', afterMatch: '' });
      }
      break;
    }

    const beforeMatch = remaining.substring(0, leftIndex);
    const match = remaining.substring(leftIndex, rightIndex + rightDelim.length);
    const afterMatch = remaining.substring(rightIndex + rightDelim.length);

    result.push({ beforeMatch, match, afterMatch });
    remaining = afterMatch;
  }

  // Add any remaining text
  if (remaining.length > 0 && !result.some((r) => r.afterMatch === remaining)) {
    result.push({ beforeMatch: remaining, match: '', afterMatch: '' });
  }

  return result;
}

/**
 * Simple random integer generator
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Simple array shuffle (Lodash-style)
 */
function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ===== CORE PARSING LOGIC =====

// TypeScript interfaces converted to JSDoc comments for reference:
// ParsedBlank: { answers: string[], options: string[] | null }
// ViewData: { [key: string]: any, content?: string }

/**
 * Parse options from {{answer}} or {{answer1|answer2||distractor1|distractor2}} syntax
 * Extracted from BlanksCard.optionsFromString() method
 */
function optionsFromString(s) {
  if (!s.startsWith('{{') || !s.endsWith('}}')) {
    throw new Error(`string ${s} is not fill-in text - must look like "{{someText}}"`);
  }

  s = s.substring(2, s.length - 2);
  const split = s.split('||');

  if (split.length > 1) {
    // Multiple choice format: {{answer1|answer2||distractor1|distractor2}}
    const answers = split[0].split('|').map((a) => a.trim());

    // Remove answers from distractors (makes for easier editing)
    const distractors = split[1]
      .split('|')
      .map((d) => d.trim())
      .filter((d) => !answers.includes(d));

    const options = [...distractors];
    options.push(answers[randomInt(0, answers.length - 1)]);

    return {
      answers,
      options: shuffle(options),
    };
  } else {
    // Fill-in-blank format: {{answer}}
    return {
      answers: [s.trim()],
      options: null,
    };
  }
}

// ===== BLANKS CARD CLASS =====

export class BlanksCard {
  constructor(data) {
    if (!data || data.length === 0) {
      throw new Error('BlanksCard requires ViewData');
    }

    const content = String(data[0]?.content || '');

    // Find all {{...}} patterns
    const splitText = splitByDelimiters(content, '{{', '}}');
    let processedText = content;

    // Process the first blank found (simplified from original)
    for (const segment of splitText) {
      if (segment.match && segment.match.startsWith('{{') && segment.match.endsWith('}}')) {
        const parsed = optionsFromString(segment.match);
        this.answers = parsed.answers;
        this.options = parsed.options;

        // Replace the blank with a placeholder for display
        const placeholder = this.options ? '[Multiple Choice]' : '[Fill in the blank]';
        processedText = processedText.replace(segment.match, placeholder);
        break; // Only process first blank for MVP
      }
    }

    this.mdText = processedText;

    // Fallback if no blanks found
    if (!this.answers) {
      this.answers = [];
      this.options = null;
    }
  }

  /**
   * Check if a given answer is correct
   */
  isCorrect(answer) {
    if (typeof answer === 'string') {
      return this.answers.includes(answer.trim());
    }

    if (Array.isArray(answer)) {
      return answer.every((a, index) => index < this.answers.length && this.answers[index] === a);
    }

    // Multiple choice format: {choiceList: string[], selection: number}
    if (answer && typeof answer === 'object' && 'selection' in answer && 'choiceList' in answer) {
      const selectedChoice = answer.choiceList[answer.selection];
      return this.answers.includes(selectedChoice);
    }

    return false;
  }
}

// ===== SPELLING GRADING =====

/**
 * Grade a spelling attempt and provide visual feedback
 * Extracted from packages/courseware/src/default/questions/fillIn/blanksCorrection.ts
 */
export function gradeSpellingAttempt(attempt, answer) {
  const result = new Array(answer.length).fill('_');
  const attemptChars = attempt.split('');

  // First pass: match characters in correct positions
  for (let i = 0; i < answer.length; i++) {
    if (i < attemptChars.length && attemptChars[i] === answer[i]) {
      result[i] = attemptChars[i];
      attemptChars[i] = '';
    }
  }

  // Second pass: match remaining characters from right to left
  for (let i = answer.length - 1; i >= 0; i--) {
    if (result[i] === '_') {
      const charIndex = attemptChars.findIndex((char) => char === answer[i]);
      if (charIndex !== -1) {
        result[i] = answer[i];
        attemptChars[charIndex] = '';
      }
    }
  }

  return result.join(' ');
}

// ===== EXPORTS =====

export { optionsFromString, splitByDelimiters };
