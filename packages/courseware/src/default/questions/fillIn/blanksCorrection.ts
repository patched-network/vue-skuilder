'use strict';

function gradeSpellingAttempt(attempt: string, answer: string): string {
  // attempt = attempt.trim();
  const result: string[] = new Array(answer.length).fill('_');
  const attemptChars = attempt.split('');

  console.log(attempt, answer);

  console.log(
    'Attempt char codes:',
    attempt.split('').map(c => c.charCodeAt(0))
  );
  console.log(
    'Answer char codes:',
    answer.split('').map(c => c.charCodeAt(0))
  );

  // alert('hello');

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
      const charIndex = attemptChars.findIndex(char => char === answer[i]);
      if (charIndex !== -1) {
        result[i] = answer[i];
        attemptChars[charIndex] = '';
      }
    }
  }

  console.log(result.join(' '));

  return result.join(' ');
}

export default gradeSpellingAttempt;
