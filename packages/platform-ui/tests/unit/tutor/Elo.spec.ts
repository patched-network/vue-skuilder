// [ ] move this file to be closer to its unit-under-test - migrated to common pkg
import { adjustCourseScores, CourseElo, toCourseElo } from '@vue-skuilder/common';

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
        // Any positive score is a success: the user gains what the card loses.
        const adjusted = adjustCourseScores(structuredClone(a), structuredClone(b), 0.5);

        expect(adjusted.userElo.global.score).toBeGreaterThan(testScore);
        expect(adjusted.cardElo.global.score).toBe(
          2 * testScore - adjusted.userElo.global.score
        );
      });
    });
  });
});

describe('toCourseElo', () => {
  it('throws with invalid inputs', () => {
    const str = 'notanelo';
    expect(() => toCourseElo(str as unknown as CourseElo)).toThrow();
  });
});
