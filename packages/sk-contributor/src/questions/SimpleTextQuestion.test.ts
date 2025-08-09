import { describe, it, expect } from 'vitest';
import { SimpleTextQuestion } from './SimpleTextQuestion';

describe('SimpleTextQuestion', () => {
  it('should correctly evaluate a correct answer', () => {
    const question = new SimpleTextQuestion([
      { questionText: 'What is the capital of France?', correctAnswer: 'Paris' },
    ]);
    expect(question.evaluate({ response: 'Paris' }, 0).isCorrect).toBe(true);
  });

  it('should correctly evaluate an incorrect answer', () => {
    const question = new SimpleTextQuestion([
      { questionText: 'What is the capital of France?', correctAnswer: 'Paris' },
    ]);
    expect(question.evaluate({ response: 'London' }, 0).isCorrect).toBe(false);
  });

  it('should be case-insensitive', () => {
    const question = new SimpleTextQuestion([
      { questionText: 'What is the capital of France?', correctAnswer: 'Paris' },
    ]);
    expect(question.evaluate({ response: 'paris' }, 0).isCorrect).toBe(true);
  });
});
