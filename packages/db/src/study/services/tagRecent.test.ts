import { describe, it, expect } from 'vitest';
import { TAG_RECENT_MAX, pushTagPresentation, type CourseElo, type EloRank } from '@vue-skuilder/common';
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
      { at: '2026-09-18T00:00:00.000Z', ok: true, perf: 0.6, card: 'c-ml-worth-3' },
    ]);
    expect(elo.tags['gpc:expose:w-W']).toBeUndefined();
  });

  it('records a first-attempt miss as ok:false', () => {
    const elo = blank();
    recordTagPresentations(elo, { _global: 0, 'gpc:exercise:sh-SH': 0 }, [rec(0, false)], 'c-ml-hush-2', 't');
    expect(elo.tags['gpc:exercise:sh-SH'].recent).toEqual([{ at: 't', ok: false, perf: 0, card: 'c-ml-hush-2' }]);
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
