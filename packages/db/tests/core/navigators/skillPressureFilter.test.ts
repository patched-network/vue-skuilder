import { describe, it, expect } from 'vitest';
import type { CourseElo, EloRank } from '@vue-skuilder/common';
import SkillPressureFilter, { skillPressures } from '../../../src/core/navigators/filters/skillPressure';
import type { WeightedCard } from '../../../src/core/navigators/index';
import type { FilterContext } from '../../../src/core/navigators/filters/types';
import type { CourseDBInterface } from '../../../src/core/interfaces/courseDB';
import type { UserDBInterface } from '../../../src/core/interfaces/userDB';
import type { ContentNavigationStrategyData } from '../../../src/core/types/contentNavigationStrategy';

/** A rated skill with `n` first attempts, `right` of them right, over two days. */
function skill(score: number, n = 12, right = n): EloRank {
  return {
    score,
    count: Math.max(n, 10),
    recent: Array.from({ length: n }, (_, i) => ({
      at: `2026-11-0${1 + (i % 2)}T12:00:00.000Z`,
      ok: i < right,
      tagOk: i < right,
      perf: i < right ? 0.8 : 0,
      card: `c${i}`,
    })),
  };
}

const elo: CourseElo = {
  global: { score: 1500, count: 500 },
  tags: {
    'exercise:a': skill(1500),
    'exercise:b': skill(1500),
    'exercise:c': skill(1500),
    'exercise:d': skill(1500),
    'exercise:low': skill(1350), // 150 below the median: need 1
    'exercise:shaky': skill(1500, 12, 6), // at the median, right half the time
  },
  misc: {},
};

const card = (id: string, tags: string[]): WeightedCard => ({
  cardId: id,
  courseId: 'c',
  score: 1,
  tags,
  provenance: [{ strategy: 'test', strategyName: 'T', strategyId: 'T', action: 'generated', score: 1, reason: 't' }],
});

function filter(serializedData = ''): SkillPressureFilter {
  return new SkillPressureFilter({} as UserDBInterface, {} as CourseDBInterface, {
    name: 'Skill Pressure',
    serializedData,
  } as ContentNavigationStrategyData);
}

const ctx = (userCourseElo?: CourseElo): FilterContext => ({
  user: {} as UserDBInterface,
  course: {} as CourseDBInterface,
  userElo: 1500,
  ...(userCourseElo ? { userCourseElo } : {}),
});

describe('skill pressure', () => {
  it('pressures low-rated skills by need, and shaky ones by insecurity', () => {
    const p = skillPressures(elo);
    expect(p.get('exercise:low')?.pressure).toBe(1);
    expect(p.get('exercise:shaky')?.pressure).toBe(0.8);
    expect(p.has('exercise:a')).toBe(false);
    expect(skillPressures(elo, { security: false }).has('exercise:shaky')).toBe(false);
  });

  it('boosts by the card’s neediest tag (max, not product), up to ×1.5', async () => {
    const out = await filter().transform(
      [card('both', ['exercise:low', 'exercise:shaky']), card('shaky', ['exercise:shaky']), card('fine', ['exercise:a'])],
      ctx(elo)
    );
    expect(out[0].score).toBeCloseTo(1.5);
    expect(out[1].score).toBeCloseTo(1.4);
    expect(out[2].score).toBe(1);
    expect(out[0].provenance.at(-1)?.reason).toContain('exercise:low');
  });

  it('passes everything through without the learner’s ratings', async () => {
    const cards = [card('x', ['exercise:low'])];
    expect(await filter().transform(cards, ctx())).toEqual(cards);
  });
});
