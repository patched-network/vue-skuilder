import gradeSpellingAttempt from './blanksCorrection';
import { adjustCourseScores } from '@vue-skuilder/common';

const testScore = 800;

describe('adjustScores', () => {
  it('produces outputs from different eloish inputs', () => {
    const elos = [
      testScore,
      {
        global: {
          score: testScore,
          count: 0,
        },
        tags: {},
        misc: {},
      },
      {
        score: testScore,
        count: 0,
      },
    ];

    elos.forEach((a) => {
      elos.forEach((b) => {
        const adjusted = adjustCourseScores(a, b, 0.5);

        expect(adjusted.cardElo.global.score).not.toBeNull();
        expect(adjusted.userElo.global.score).not.toBeNull();
        expect(adjusted.cardElo.global.score).toBe(testScore);
        expect(adjusted.userElo.global.score).toBe(testScore);
      });
    });
  });
});

describe('gradeSpellingEvent', () => {
  interface t {
    attempt: string;
    answer: string;
    expected: string;
  }
  const cases: t[] = [
    // hello
    { attempt: 'hello', answer: 'hello', expected: 'h e l l o' },
    { attempt: 'hella', answer: 'hello', expected: 'h e l l _' },
    { attempt: 'hell', answer: 'hello', expected: 'h e l l _' },
    // { attempt: 'helllo', answer: 'hello', expected: 'h e l l _' },
    { attempt: 'helo', answer: 'hello', expected: 'h e l _ o' },
    { attempt: 'heo', answer: 'hello', expected: 'h e _ _ o' },
    { attempt: 'he', answer: 'hello', expected: 'h e _ _ _' },
    { attempt: 'h', answer: 'hello', expected: 'h _ _ _ _' },
    { attempt: 'e', answer: 'hello', expected: '_ e _ _ _' },
    { attempt: 'l', answer: 'hello', expected: '_ _ _ l _' },
    { attempt: 'o', answer: 'hello', expected: '_ _ _ _ o' },
    { attempt: 'lo', answer: 'hello', expected: '_ _ _ l o' },
    { attempt: '', answer: 'hello', expected: '_ _ _ _ _' },

    // rate
    { attempt: 'te', answer: 'rate', expected: '_ _ t e' },

    // chuck
    { attempt: 'chuk', answer: 'chuck', expected: 'c h u _ k' },
  ];
  cases.forEach((c) => {
    it(`grades attempt [${c.attempt}] for answer [${c.answer}]`, () => {
      const result = gradeSpellingAttempt(c.attempt, c.answer);
      const joined = result.split(' ').join('');
      expect(joined.length).toEqual(c.answer.length);
      expect(result).toBe(c.expected);
    });
  });
});
