/**
 * Derivations over a `LearnerDataset`: pure functions that views, text
 * exports, and (later) detectors share. Ported from LettersPractice's admin
 * service, with LP's domain knowledge moved behind `DiagnosticsInterpreters`.
 *
 * "Now" is always `dataset.asOf`, never the wall clock, so a dump reads the
 * same tomorrow as today.
 */
import type {
  SessionEloEvent,
  SessionStateSnapshot,
  StudySessionDoc,
  StudySessionRunSummary,
} from '../core/types/studySession';
import type { CardSummary, DatasetRecord, LearnerDataset } from './dataset';

/**
 * Course-supplied meaning for the generic views. Every member is optional and
 * has a neutral default.
 */
export interface DiagnosticsInterpreters {
  /** Tags that name what a card exercises: shown inline and sorted first. Default: none. */
  isSkillTag?(tag: string): boolean;
  /** Compact display form of a tag. Default: unchanged. */
  shortTag?(tag: string): string;
  /**
   * Numbers to read off a session's state snapshot, by display label.
   * Default: every numeric field up to two levels deep, labelled by its path.
   */
  snapshotMetrics?(snapshot: SessionStateSnapshot): Record<string, number>;
  /** Which `snapshotMetrics` labels count as progress (for `stalled`). Default: none. */
  progressMetrics?: string[];
}

export const isSkillTag = (i: DiagnosticsInterpreters | undefined, tag: string): boolean =>
  i?.isSkillTag?.(tag) ?? false;

export const shortTag = (i: DiagnosticsInterpreters | undefined, tag: string): string =>
  i?.shortTag?.(tag) ?? tag;

/** Skill tags first, then alphabetical. */
function bySkillThenName(i: DiagnosticsInterpreters | undefined) {
  return (a: string, b: string): number => {
    const d = Number(isSkillTag(i, b)) - Number(isSkillTag(i, a));
    return d !== 0 ? d : a.localeCompare(b);
  };
}

function defaultSnapshotMetrics(snapshot: SessionStateSnapshot): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(snapshot)) {
    if (typeof v === 'number') out[k] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
        if (typeof v2 === 'number') out[`${k}.${k2}`] = v2;
      }
    }
  }
  return out;
}

// ============================================================================
// Sessions
// ============================================================================

/**
 * Ways a session failed to do its job. `out-of-content` is LP's `starved`,
 * renamed so it isn't confused with intake starvation (no new cards chosen).
 */
export type SessionFlag = 'churned' | 'out-of-content' | 'walked' | 'stalled' | 'grinding';

export const SESSION_FLAGS: Record<SessionFlag, { label: string; help: string }> = {
  churned: {
    label: 'Churned',
    help: 'Many pipeline runs relative to cards served: the plan kept being rebuilt rather than consumed.',
  },
  'out-of-content': {
    label: 'Out of content',
    help: 'Ended with time left on the clock: content ran out before the session did.',
  },
  walked: {
    label: 'Walked',
    help: 'Abandoned or never closed, after real time invested. Not a mis-click.',
  },
  stalled: {
    label: 'Stalled',
    help: 'No progress metric moved and ELO was essentially flat. The sitting produced nothing measurable.',
  },
  grinding: {
    label: 'Grinding',
    help: 'Majority-incorrect, or ended with unfinished cards still in the failed queue.',
  },
};

/** First guesses, not measurements: nothing yet records whether a flag was right. */
export const SESSION_FLAG_THRESHOLDS = {
  /** Runs per card above which a session counts as churned. */
  churnRunsPerCard: 1 / 3,
  /** Minimum cards before churn is meaningful. */
  churnMinCards: 4,
  /** Leftover clock (s) that counts as running out of content. */
  outOfContentSeconds: 20,
  /** Cards below which an abandon reads as a mis-click, not a walk-out. */
  walkMinCards: 2,
  /** |ELO change| below which movement is flat. */
  stallEloEpsilon: 5,
  /** Accuracy below which a session is grinding. */
  grindAccuracy: 0.5,
};

export interface SessionStateRow {
  label: string;
  from: number | null;
  to: number | null;
  delta: number | null;
}

export interface SessionSummary {
  doc: StudySessionDoc;
  /** Null while a session is `open`. */
  durationSeconds: number | null;
  accuracy: number | null;
  /** Net learner global-ELO change over the session's ELO events. Null when it has none. */
  eloNet: number | null;
  /** Snapshot metrics at start and end. */
  state: SessionStateRow[];
  flags: SessionFlag[];
}

function stateRows(doc: StudySessionDoc, interp?: DiagnosticsInterpreters): SessionStateRow[] {
  const read = interp?.snapshotMetrics ?? defaultSnapshotMetrics;
  const a = doc.stateAtStart ? read(doc.stateAtStart) : {};
  const b = doc.stateAtEnd ? read(doc.stateAtEnd) : {};
  const labels = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return labels.map((label) => {
    const from = a[label] ?? null;
    const to = b[label] ?? null;
    return { label, from, to, delta: from !== null && to !== null ? to - from : null };
  });
}

function flagSession(
  s: Omit<SessionSummary, 'flags'>,
  interp?: DiagnosticsInterpreters
): SessionFlag[] {
  const T = SESSION_FLAG_THRESHOLDS;
  const { doc, accuracy, eloNet } = s;
  const flags: SessionFlag[] = [];
  const cards = doc.tally?.cardsPresented ?? 0;
  const runs = doc.runs?.length ?? 0;

  if (cards >= T.churnMinCards && runs / cards > T.churnRunsPerCard) flags.push('churned');

  // Only a closed session can run out of content; an abandoned one has time left by definition.
  if (doc.status === 'closed' && (doc.tally?.secondsRemaining ?? 0) > T.outOfContentSeconds) {
    flags.push('out-of-content');
  }

  if (doc.status === 'open') flags.push('walked');
  else if (doc.status === 'abandoned' && cards >= T.walkMinCards) flags.push('walked');

  // Needs something measurable, else every session without snapshots or ELO events would flag.
  const progress = s.state.filter((r) => interp?.progressMetrics?.includes(r.label));
  const measurable = eloNet !== null || progress.some((r) => r.delta !== null);
  if (
    cards > 0 &&
    measurable &&
    progress.every((r) => (r.delta ?? 0) === 0) &&
    Math.abs(eloNet ?? 0) < T.stallEloEpsilon
  ) {
    flags.push('stalled');
  }

  if (
    (accuracy !== null && accuracy < T.grindAccuracy && cards > 0) ||
    (doc.tally?.failedQRemaining ?? 0) > 0
  ) {
    flags.push('grinding');
  }
  return flags;
}

export function summarizeSession(
  doc: StudySessionDoc,
  interp?: DiagnosticsInterpreters
): SessionSummary {
  const start = Date.parse(doc.startTime);
  const end = doc.endTime ? Date.parse(doc.endTime) : NaN;
  const durationSeconds =
    Number.isNaN(start) || Number.isNaN(end) ? null : Math.round((end - start) / 1000);

  const responses = doc.tally?.responses ?? 0;
  const accuracy = responses > 0 ? (doc.tally?.correct ?? 0) / responses : null;

  const events = doc.eloEvents ?? [];
  const eloNet = events.length
    ? events.reduce((n, e) => n + (e.global.after - e.global.before), 0)
    : null;

  const base = { doc, durationSeconds, accuracy, eloNet, state: stateRows(doc, interp) };
  return { ...base, flags: flagSession(base, interp) };
}

/** Every session in the dataset, newest first. */
export function summarizeSessions(
  ds: LearnerDataset,
  interp?: DiagnosticsInterpreters
): SessionSummary[] {
  return ds.sessions.map((d) => summarizeSession(d, interp)).reverse();
}

// ============================================================================
// Session timeline
// ============================================================================

/** A `SessionEloEvent` reshaped for one response row: deltas precomputed, tags as a sorted array. */
export interface ResponseEloDelta {
  userScore: number;
  global: { before: number; after: number; delta: number };
  card?: { before: number; after: number; delta: number };
  /** `score: null` is a count-only exposure that moves count, not ELO. */
  tags: Array<{ tag: string; before: number; after: number; delta: number; score: number | null }>;
}

export interface TimelineResponse {
  kind: 'response';
  at: string;
  cardId: string;
  /** Absent when the dataset has no course slice. */
  card?: CardSummary;
  tags: string[];
  questionType?: string;
  isCorrect: boolean | null;
  timeSpentMs: number;
  priorAttempts: number | null;
  userAnswer: unknown;
  /**
   * The ELO exchange this response produced, joined from `eloEvents` by card
   * and nearest time. Absent on retries (only first attempts move ELO), on
   * events in flight at close, and on sessions predating ELO events.
   */
  elo?: ResponseEloDelta;
}

export interface TimelineRun {
  kind: 'run';
  at: string;
  run: StudySessionRunSummary;
}

/**
 * Responses and pipeline runs in one time-ordered stream: a replan firing
 * between two failures is the thing worth seeing, and a per-card pivot can't
 * show sequence.
 */
export type TimelineEntry = TimelineResponse | TimelineRun;

export interface SessionDetail {
  summary: SessionSummary;
  timeline: TimelineEntry[];
  /** The tally claims more responses than records stamped with this session were found. */
  responsesMissing: boolean;
}

function toResponseEloDelta(
  ev: SessionEloEvent,
  interp?: DiagnosticsInterpreters
): ResponseEloDelta {
  const order = bySkillThenName(interp);
  const tags = Object.entries(ev.tags ?? {})
    .map(([tag, t]) => ({
      tag,
      before: t.before,
      after: t.after,
      delta: t.after - t.before,
      score: t.score,
    }))
    .sort((a, b) => order(a.tag, b.tag));
  return {
    userScore: ev.userScore,
    global: {
      before: ev.global.before,
      after: ev.global.after,
      delta: ev.global.after - ev.global.before,
    },
    ...(ev.card
      ? {
          card: {
            before: ev.card.before,
            after: ev.card.after,
            delta: ev.card.after - ev.card.before,
          },
        }
      : {}),
    tags,
  };
}

/**
 * Attach each ELO event to its response. The event carries no record id, so
 * join by card and nearest time, using each response at most once. A record
 * is stamped when the card is shown and an event when the answer is
 * submitted, so the join is on the response's end (shown + time spent):
 * joined on the start, a long response's event lands on the next attempt.
 */
function attachEloEvents(
  responses: TimelineResponse[],
  events: SessionEloEvent[],
  interp?: DiagnosticsInterpreters
): void {
  const used = new Set<number>();
  for (const ev of events) {
    const evT = Date.parse(ev.at);
    let best = -1;
    let bestGap = Infinity;
    responses.forEach((r, i) => {
      if (used.has(i) || r.cardId !== ev.cardId) return;
      const gap = Math.abs(Date.parse(r.at) + r.timeSpentMs - evT);
      if (gap < bestGap) {
        bestGap = gap;
        best = i;
      }
    });
    if (best >= 0) {
      used.add(best);
      responses[best].elo = toResponseEloDelta(ev, interp);
    }
  }
}

function byTime(a: { at: string }, b: { at: string }): number {
  const ta = Date.parse(a.at);
  const tb = Date.parse(b.at);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return a.at.localeCompare(b.at);
  return ta - tb;
}

/** One session's summary and interleaved timeline, or null if the dataset has no such session. */
export function sessionDetail(
  ds: LearnerDataset,
  sessionId: string,
  interp?: DiagnosticsInterpreters
): SessionDetail | null {
  const doc = ds.sessions.find((s) => s.sessionId === sessionId);
  if (!doc) return null;

  const responses: TimelineResponse[] = [];
  for (const h of ds.cardHistories) {
    const card = ds.cards?.get(h.cardID);
    for (const r of h.records) {
      if (r.sessionId !== sessionId) continue;
      responses.push({
        kind: 'response',
        at: r.timeStamp,
        cardId: h.cardID,
        ...(card ? { card, questionType: card.questionType } : {}),
        tags: card ? [...card.tags].sort(bySkillThenName(interp)) : [],
        isCorrect: typeof r.isCorrect === 'boolean' ? r.isCorrect : null,
        timeSpentMs: r.timeSpent ?? 0,
        priorAttempts: typeof r.priorAttemps === 'number' ? r.priorAttemps : null,
        userAnswer: r.userAnswer,
      });
    }
  }
  if (doc.eloEvents?.length) attachEloEvents(responses, doc.eloEvents, interp);

  const runs: TimelineRun[] = (doc.runs ?? []).map((run) => ({ kind: 'run', at: run.at, run }));
  const timeline: TimelineEntry[] = [...runs, ...responses].sort(byTime);

  return {
    summary: summarizeSession(doc, interp),
    timeline,
    responsesMissing: (doc.tally?.responses ?? 0) > responses.length,
  };
}

/** Per-tag rollup of what a session served. */
export interface ServedTagStat {
  tag: string;
  /** Responses carrying this tag (a response with several tags counts toward each). */
  responses: number;
  correct: number;
  incorrect: number;
  /** correct / graded; null when nothing gradeable was served. */
  accuracy: number | null;
  totalTimeMs: number;
  /** Distinct cards carrying this tag. */
  cards: number;
}

/** Skill tags first, then most-served. */
export function servedTags(
  timeline: TimelineEntry[],
  interp?: DiagnosticsInterpreters
): ServedTagStat[] {
  const byTag = new Map<
    string,
    {
      responses: number;
      correct: number;
      incorrect: number;
      totalTimeMs: number;
      cards: Set<string>;
    }
  >();
  for (const e of timeline) {
    if (e.kind !== 'response') continue;
    for (const tag of e.tags) {
      let s = byTag.get(tag);
      if (!s) {
        s = { responses: 0, correct: 0, incorrect: 0, totalTimeMs: 0, cards: new Set() };
        byTag.set(tag, s);
      }
      s.responses += 1;
      s.totalTimeMs += e.timeSpentMs;
      s.cards.add(e.cardId);
      if (e.isCorrect === true) s.correct += 1;
      else if (e.isCorrect === false) s.incorrect += 1;
    }
  }
  return [...byTag.entries()]
    .map(([tag, s]) => {
      const graded = s.correct + s.incorrect;
      return {
        tag,
        responses: s.responses,
        correct: s.correct,
        incorrect: s.incorrect,
        accuracy: graded > 0 ? s.correct / graded : null,
        totalTimeMs: s.totalTimeMs,
        cards: s.cards.size,
      };
    })
    .sort((a, b) => {
      const d = Number(isSkillTag(interp, b.tag)) - Number(isSkillTag(interp, a.tag));
      if (d !== 0) return d;
      if (b.responses !== a.responses) return b.responses - a.responses;
      return a.tag.localeCompare(b.tag);
    });
}

/**
 * A session's net global-ELO move split into wins and losses, so an
 * accuracy/ELO mismatch (many small wins, a few big losses) is legible.
 */
export interface EloLedger {
  count: number;
  net: number;
  gained: number;
  lost: number;
  wins: number;
  losses: number;
}

export function eloLedger(timeline: TimelineEntry[]): EloLedger | null {
  const ledger: EloLedger = { count: 0, net: 0, gained: 0, lost: 0, wins: 0, losses: 0 };
  for (const e of timeline) {
    if (e.kind !== 'response' || !e.elo) continue;
    const g = e.elo.global.delta;
    ledger.count += 1;
    ledger.net += g;
    if (g > 0) {
      ledger.gained += g;
      ledger.wins += 1;
    } else if (g < 0) {
      ledger.lost += g;
      ledger.losses += 1;
    }
  }
  return ledger.count ? ledger : null;
}

// ============================================================================
// Card dossiers
// ============================================================================

/** Fails at or above which an unmoved card ELO counts as frozen. */
const FROZEN_FAIL_THRESHOLD = 3;

/** Everything recorded about one card for one learner. */
export interface CardDossier {
  cardId: string;
  /** Absent when the dataset has no course slice. */
  card?: CardSummary;
  records: DatasetRecord[];
  lapses: number;
  streak: number;
  bestIntervalSeconds: number;
  attempts: number;
  fails: number;
  firstSeen: string | null;
  lastSeen: string | null;
  totalTimeMs: number;
  /** Earliest pending review; `overdue` is as of `dataset.asOf`. */
  pendingReview: { reviewTime: string; overdue: boolean } | null;
  cardElo: number | null;
  cardEloCount: number | null;
  /** Failed, and holding an overdue review. */
  stuck: boolean;
  /** Failed repeatedly, yet the card's ELO has fewer updates than failures. */
  frozenElo: boolean;
  /** Time sunk × (fails + 1): grind-heavy, low-payoff cards first. For sorting only. */
  painScore: number;
}

/** One dossier per card the learner has history with, most painful first. */
export function cardDossiers(ds: LearnerDataset): CardDossier[] {
  const asOf = Date.parse(ds.asOf);
  const pending = new Map<string, string>();
  for (const s of ds.scheduled) {
    const t = String(s.reviewTime);
    const prev = pending.get(s.cardId);
    if (!prev || t < prev) pending.set(s.cardId, t);
  }

  return ds.cardHistories
    .map((h): CardDossier => {
      const card = ds.cards?.get(h.cardID);
      const fails = h.records.filter((r) => r.isCorrect === false).length;
      const totalTimeMs = h.records.reduce((n, r) => n + (r.timeSpent ?? 0), 0);
      const reviewTime = pending.get(h.cardID);
      const pendingReview = reviewTime
        ? { reviewTime, overdue: Date.parse(reviewTime) <= asOf }
        : null;
      const cardElo = card?.elo?.global?.score ?? null;
      const cardEloCount = card?.elo?.global?.count ?? null;
      return {
        cardId: h.cardID,
        ...(card ? { card } : {}),
        records: h.records,
        lapses: h.lapses ?? 0,
        streak: h.streak ?? 0,
        bestIntervalSeconds: h.bestInterval ?? 0,
        attempts: h.records.length,
        fails,
        firstSeen: h.records[0]?.timeStamp ?? null,
        lastSeen: h.records[h.records.length - 1]?.timeStamp ?? null,
        totalTimeMs,
        pendingReview,
        cardElo,
        cardEloCount,
        stuck: fails > 0 && !!pendingReview?.overdue,
        frozenElo: fails >= FROZEN_FAIL_THRESHOLD && cardEloCount !== null && cardEloCount < fails,
        painScore: totalTimeMs * (fails + 1),
      };
    })
    .sort((a, b) => b.painScore - a.painScore);
}

/** A record's global performance, whether stored as a number or a per-tag map. */
export function recordPerformance(r: DatasetRecord): number | null {
  const p = r.performance as unknown;
  if (typeof p === 'number') return p;
  if (p && typeof p === 'object' && typeof (p as { _global?: unknown })._global === 'number') {
    return (p as { _global: number })._global;
  }
  return null;
}
