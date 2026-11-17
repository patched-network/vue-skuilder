import { describe, it, expect } from 'vitest';
import {
  TAG_RECENT_MAX,
  courseSecurity,
  pushTagPresentation,
  tagSecurity,
  type CourseElo,
  type EloRank,
} from '@vue-skuilder/common';
import { isFirstAttempt, recordTagPresentations } from './tagRecent';
import type { CardRecord } from '@db/core';

const rec = (priorAttemps: number, isCorrect: boolean): CardRecord =>
  ({
    isCorrect,
    priorAttemps,
    performance: 1,
    courseID: 'c',
    cardID: 'x',
    timeSpent: 1,
    timeStamp: '' as unknown as CardRecord['timeStamp'],
    userAnswer: '',
  }) as unknown as CardRecord;

const blank = (): CourseElo => ({ global: { score: 1000, count: 0 }, tags: {}, misc: {} });

describe('pushTagPresentation', () => {
  it('appends, caps at TAG_RECENT_MAX, drops the oldest, and does not mutate', () => {
    let rank: EloRank = { score: 1000, count: 0 };
    const first = { at: 't0', ok: true, perf: 1, card: 'c0' };
    rank = pushTagPresentation(rank, first);
    expect(rank.recent).toEqual([first]);

    const before = rank;
    for (let i = 1; i <= TAG_RECENT_MAX; i++) {
      rank = pushTagPresentation(rank, { at: `t${i}`, ok: i % 2 === 0, perf: 0.5, card: `c${i}` });
    }
    expect(before.recent).toHaveLength(1); // input untouched
    expect(rank.recent).toHaveLength(TAG_RECENT_MAX);
    expect(rank.recent![0].at).toBe('t1'); // t0 dropped
    expect(rank.recent![TAG_RECENT_MAX - 1].at).toBe(`t${TAG_RECENT_MAX}`);
    expect(rank.score).toBe(1000);
  });
});

describe('isFirstAttempt', () => {
  it('reads priorAttemps from the current (last) record', () => {
    expect(isFirstAttempt([rec(0, false)])).toBe(true);
    expect(isFirstAttempt([rec(0, false), rec(1, true)])).toBe(false);
  });
  it('falls back to record count when the marker is absent', () => {
    const bare = { isCorrect: true } as unknown as CardRecord;
    expect(isFirstAttempt([bare])).toBe(true);
    expect(isFirstAttempt([bare, bare])).toBe(false);
    expect(isFirstAttempt([])).toBe(false);
  });
});

describe('recordTagPresentations', () => {
  it('writes one entry per scored tag on a first attempt, skipping count-only tags', () => {
    const elo = blank();
    const written = recordTagPresentations(
      elo,
      { _global: 0.6, 'gpc:exercise:th-TH': 0.6, 'gpc:expose:w-W': null },
      [rec(0, true)],
      'c-ml-worth-3',
      '2026-09-18T00:00:00.000Z'
    );
    expect(written).toEqual(['gpc:exercise:th-TH']);
    expect(elo.tags['gpc:exercise:th-TH'].recent).toEqual([
      { at: '2026-09-18T00:00:00.000Z', ok: true, tagOk: true, perf: 0.6, card: 'c-ml-worth-3' },
    ]);
    expect(elo.tags['gpc:expose:w-W']).toBeUndefined();
  });

  it('records a first-attempt miss as ok:false', () => {
    const elo = blank();
    recordTagPresentations(elo, { _global: 0, 'gpc:exercise:sh-SH': 0 }, [rec(0, false)], 'c-ml-hush-2', 't');
    expect(elo.tags['gpc:exercise:sh-SH'].recent).toEqual([{ at: 't', ok: false, tagOk: false, perf: 0, card: 'c-ml-hush-2' }]);
  });

  it('adds nothing for a retry (priorAttemps > 0), even a correct one', () => {
    const elo = blank();
    recordTagPresentations(elo, { _global: 0, 'gpc:exercise:sh-SH': 0 }, [rec(0, false)], 'k', 't0');
    const written = recordTagPresentations(
      elo,
      { _global: 1, 'gpc:exercise:sh-SH': 1 },
      [rec(0, false), rec(1, true)],
      'k',
      't1'
    );
    expect(written).toEqual([]);
    expect(elo.tags['gpc:exercise:sh-SH'].recent).toHaveLength(1);
    expect(elo.tags['gpc:exercise:sh-SH'].recent![0].ok).toBe(false);
  });

  it('preserves score/count on an existing rank and caps the buffer', () => {
    const elo = blank();
    elo.tags['t'] = { score: 1234, count: 7 };
    for (let i = 0; i < TAG_RECENT_MAX + 3; i++) {
      recordTagPresentations(elo, { _global: 1, t: 1 }, [rec(0, true)], `card-${i}`, `t${i}`);
    }
    expect(elo.tags['t'].score).toBe(1234);
    expect(elo.tags['t'].count).toBe(7);
    expect(elo.tags['t'].recent).toHaveLength(TAG_RECENT_MAX);
    expect(elo.tags['t'].recent![0].card).toBe('card-3');
  });
});

describe('tagSecurity', () => {
  const day = (d: number) => `2026-11-${String(d).padStart(2, '0')}T12:00:00.000Z`;
  const rank = (oks: boolean[], days: number[]): EloRank => ({
    score: 1500,
    count: oks.length,
    recent: oks.map((ok, i) => ({ at: day(days[i]), ok: true, tagOk: ok, perf: ok ? 0.8 : 0, card: `c${i}` })),
  });
  const cfg = { dayOf: (at: string) => at.slice(0, 10) };

  it('unproven below minAttempts, shaky under 75% of the window, secure otherwise', () => {
    const five = Array(5).fill(true);
    expect(tagSecurity('t', rank(five, [1, 1, 2, 2, 3]), cfg).status).toBe('unproven');
    // 12 attempts, 8 right (67%): shaky; the card-level ok (all true) is ignored
    const eightOfTwelve = [...Array(8).fill(true), ...Array(4).fill(false)];
    expect(tagSecurity('t', rank(eightOfTwelve, Array(12).fill(0).map((_, i) => 1 + (i % 3))), cfg).status).toBe('shaky');
    // 6 of 6 right, all on one day: unproven (needs two days)
    expect(tagSecurity('t', rank(Array(6).fill(true), Array(6).fill(4)), cfg).status).toBe('unproven');
    expect(tagSecurity('t', rank(Array(6).fill(true), [4, 4, 4, 5, 5, 5]), cfg).status).toBe('secure');
  });

  it('falls back to perf for entries without tagOk (hinted 0.5 is not right)', () => {
    const r: EloRank = {
      score: 1500,
      count: 6,
      recent: [0.6, 0.8, 0.5, 0.8, 0.8, 0.8].map((perf, i) => ({ at: day(1 + (i % 2)), ok: true, perf, card: `c${i}` })),
    };
    const s = tagSecurity('t', r, cfg);
    expect(s.right).toBe(5);
    expect(s.status).toBe('secure');
  });

  it('courseSecurity counts met exercise tags only; a met tag with no buffer is unproven', () => {
    const elo: CourseElo = {
      global: { score: 1500, count: 100 },
      tags: {
        'gpc:exercise:a-AE': rank(Array(6).fill(true), [1, 1, 1, 2, 2, 2]),
        'gpc:exercise:a-EY': { score: 1300, count: 9 },
        'gpc:expose:a-AE': { score: -1, count: 4 },
      },
      misc: {},
    };
    const c = courseSecurity(elo, { config: cfg });
    expect(c.tags.map((t) => t.tag).sort()).toEqual(['gpc:exercise:a-AE', 'gpc:exercise:a-EY']);
    expect([c.secure, c.shaky, c.unproven, c.debt]).toEqual([1, 0, 1, 1]);
  });
});
