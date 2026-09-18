import {
  CourseElo,
  EloRank,
  TaggedPerformance,
  TagPresentation,
  pushTagPresentation,
} from '@vue-skuilder/common';
import { CardRecord } from '@db/core';

/**
 * Mastery signal: per-tag ring buffer of recent presentations.
 *
 * Written on the same path as the per-tag ELO update, one entry per
 * *presentation* of a card. Retries within a presentation (a record with
 * `priorAttemps > 0`, or any record after the first on the current card)
 * are not evidence and add nothing — including the "dismiss-failed" final
 * penalty, which reaches the ELO path on a retry record.
 *
 * Only tags the question actually graded (numeric perf) get an entry;
 * count-only exposure tags (`null`) carry no correctness signal.
 */

/** The record for the presentation being graded, or null if none is visible. */
function currentRecord(records: readonly CardRecord[]): CardRecord | null {
  return records.length ? records[records.length - 1] : null;
}

/**
 * Whether the record under grading is the first attempt of its presentation.
 *
 * `priorAttemps` is the authoritative marker (written by the question view).
 * When it is absent (non-question records, or a caller that did not push the
 * record onto `currentCard.records`), fall back to the presentation's record
 * count. With no record visible at all we cannot tell, and say no.
 */
export function isFirstAttempt(records: readonly CardRecord[]): boolean {
  const rec = currentRecord(records);
  if (!rec) return false;
  const prior = (rec as { priorAttemps?: unknown }).priorAttemps;
  if (typeof prior === 'number') return prior === 0;
  return records.length === 1;
}

/**
 * Append a presentation entry to every scored tag in `perf`, mutating
 * `userElo.tags[tag]` in place (each rank object is replaced, not mutated).
 * No-op for retries. Returns the tags that received an entry.
 */
export function recordTagPresentations(
  userElo: CourseElo,
  perf: TaggedPerformance,
  records: readonly CardRecord[],
  cardId: string,
  at: string
): string[] {
  if (!isFirstAttempt(records)) return [];
  const rec = currentRecord(records) as { isCorrect?: unknown } | null;
  const ok = rec?.isCorrect === true;

  const written: string[] = [];
  for (const [tag, score] of Object.entries(perf)) {
    if (tag === '_global') continue;
    if (typeof score !== 'number') continue; // count-only exposure tag
    const rank: EloRank = userElo.tags[tag] ?? { score: userElo.global.score, count: 0 };
    const entry: TagPresentation = { at, ok, perf: score, card: cardId };
    userElo.tags[tag] = pushTagPresentation(rank, entry);
    written.push(tag);
  }
  return written;
}
