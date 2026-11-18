import { describe, it, expect } from 'vitest';
import {
  adjustCourseScores,
  adjustCourseScoresPerTag,
  eloActual,
  CourseElo,
} from '@vue-skuilder/common';

const expectedFor = (user: number, card: number) => 1 / (1 + Math.pow(10, (card - user) / 400));

function course(score: number, count = 50, tags: Record<string, number> = {}): CourseElo {
  return {
    global: { score, count },
    tags: Object.fromEntries(Object.entries(tags).map(([k, v]) => [k, { score: v, count }])),
    misc: {},
  };
}

describe('ELO never flips the sign of a result', () => {
  const gaps = [-600, -300, -100, 0, 100, 241, 300, 500, 800];
  const scores = [0.05, 0.4, 0.5, 0.8, 0.9, 1];

  it('a positive score never lowers the learner or raises the card', () => {
    for (const gap of gaps) {
      for (const s of scores) {
        const before = course(1400, 50, { 'gpc:exercise:a-AE': 1400 });
        const card = course(1400 - gap, 50, { 'gpc:exercise:a-AE': 1400 - gap });
        const out = adjustCourseScoresPerTag(
          structuredClone(before),
          structuredClone(card),
          { _global: s, 'gpc:exercise:a-AE': s }
        );
        expect(out.userElo.global.score).toBeGreaterThanOrEqual(1400);
        expect(out.userElo.tags['gpc:exercise:a-AE'].score).toBeGreaterThanOrEqual(1400);
        expect(out.cardElo.global.score).toBeLessThanOrEqual(1400 - gap);
      }
    }
  });

  it('a miss never raises the learner', () => {
    for (const gap of gaps) {
      const out = adjustCourseScores(course(1400), course(1400 - gap), 0);
      expect(out.userElo.global.score).toBeLessThanOrEqual(1400);
    }
  });

  it('a faster answer gains at least as much as a slower one', () => {
    for (const gap of gaps) {
      const slow = adjustCourseScores(course(1400), course(1400 - gap), 0.8);
      const fast = adjustCourseScores(course(1400), course(1400 - gap), 1);
      expect(fast.userElo.global.score).toBeGreaterThanOrEqual(slow.userElo.global.score);
    }
  });

  it('the audit case: a slow correct answer on a card 300 below gains', () => {
    const out = adjustCourseScores(course(1430), course(1130), 0.8);
    expect(out.userElo.global.score).toBeGreaterThan(1430);
  });
});

describe('ELO equilibrium', () => {
  // Expected change is zero where p·(actual − exp) + (1 − p)·(0 − exp) = 0,
  // i.e. rating gap = true gap + 400·log10(t). The audit's §2 offset.
  it('settles at the true gap plus 400·log10(t)', () => {
    for (const t of [0.5, 0.8, 1]) {
      for (const trueGap of [-200, 0, 300, 600]) {
        const p = expectedFor(trueGap, 0);
        const gap = trueGap + 400 * Math.log10(t);
        const exp = expectedFor(gap, 0);
        const drift = p * (eloActual(t, exp) - exp) + (1 - p) * (0 - exp);
        expect(Math.abs(drift)).toBeLessThan(1e-9);
      }
    }
  });
});
