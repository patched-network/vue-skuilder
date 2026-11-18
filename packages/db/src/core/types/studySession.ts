import { DocType, DocTypePrefixes } from './types-legacy';
import type { ReplanHints } from '../navigators/generators/types';
import type { GeneratorSummary, FilterImpact, RunVersions } from '../navigators/PipelineDebugger';
import type { RegulatorReading } from '../navigators/regulators';
import type { StrategyContribution } from '../navigators';

/**
 * Durable per-sitting record. Join target for `CardRecord.sessionId`.
 *
 * Written twice: `open` at `prepareSession()`, overwritten at termination.
 */
export interface StudySessionDoc {
  /** `SESSION::{courseId}::{userId}::{sessionId}` */
  _id: string;
  _rev?: string;
  docType: DocType.STUDY_SESSION;

  sessionId: string;
  courseId: string;
  userId: string;

  /** Session construction time, not first-card time. */
  startTime: string;
  endTime?: string;

  /**
   * `closed` — ran to natural termination.
   * `abandoned` — host tore the study view down mid-session.
   * `open` — never closed: tab closed, reload, crash. No tally or end state.
   */
  status: 'open' | 'closed' | 'abandoned';

  plannedSeconds: number;

  config: {
    defaultBatchLimit: number;
    sourceCount: number;
    initHints?: ReplanHints | null;
  };

  /**
   * The code this session ran on: the framework's version (`'dev'` when run
   * from source) and the host app's, if it reported one (`appVersion` in the
   * data-layer config). Strategy and content versions are stamped per run.
   * Absent on sessions recorded before this shipped.
   */
  versions?: { framework: string; app?: string };

  /** Queue depths after the bootstrap run, before the first draw. */
  initialQueues: { supplyQ: number; failedQ: number };

  tally?: {
    /** Distinct cards; a re-presented failed card counts once. */
    cardsPresented: number;
    /** Total responses, including repeat attempts on one card. */
    responses: number;
    correct: number;
    incorrect: number;
    failedQRemaining: number;
    secondsRemaining: number;
  };

  /** Bootstrap run plus every replan, in execution order. */
  runs?: StudySessionRunSummary[];

  /**
   * Per-response ELO exchanges, in the order they resolved. One entry per
   * ELO-updating response (first attempt of a presentation; retries don't
   * move ELO). Flushed at close from an in-memory log — so `open`/`abandoned`
   * sessions that never reached the close write carry none, and a same-card
   * event still in flight at close may be missing. Absent on sessions
   * recorded before this shipped.
   */
  eloEvents?: SessionEloEvent[];

  finalHints?: ReplanHints | null;

  stateAtStart?: SessionStateSnapshot;
  stateAtEnd?: SessionStateSnapshot;
}

export interface StudySessionRunSummary {
  /** Joins to `PipelineRunReport.runId` while that run is still in memory. */
  runId: string;
  at: string;
  /** `'bootstrap'`, a replan's label, or `'(auto)'`. */
  label: string;
  mode?: string;
  generatedCount: number;
  finalCount: number;
  reviewsSelected: number;
  newSelected: number;

  // --- Detail projected from PipelineRunReport at record time ------------
  // These make a run self-explanatory after the in-memory ring buffer that
  // holds the full `PipelineRunReport` has rolled over (MAX_RUNS=10) — which
  // is almost always, by the time anyone reads a persisted session. The
  // multi-KB per-card provenance trail is deliberately NOT persisted; only
  // the compact phase summaries are. All optional: absent on runs recorded
  // before this shipped, and on any run whose report lacked the field.

  /** User's global ELO at the moment this run's pipeline executed. */
  userElo?: number;
  /** Per-generator contribution (name, card/new/review counts, top score). */
  generators?: GeneratorSummary[];
  /** Per-filter impact (boosted / penalized / passed / removed). */
  filters?: FilterImpact[];
  /** Ephemeral replan hints in force for this run (what the navigator was told). */
  hints?: ReplanHints;
  /** Compact summary of the scored-but-dropped candidate tail. */
  discardedTail?: {
    count: number;
    scoreRange?: [number, number];
    eloRange?: [number, number];
    note: string;
  };
  /**
   * The selected cards, then the top few unselected ones, each in score
   * order. The lowest selected score against the first runner-up is this
   * run's cutoff.
   */
  cards?: StudySessionRunCard[];
  /**
   * The unselected non-review cards most worth explaining, with their
   * score-changing provenance. See `PipelineRunReport.unselectedNew`.
   */
  unselectedNew?: {
    nextInLine?: StudySessionRunCardTrail;
    topGenerated?: StudySessionRunCardTrail;
  };
  /** The regulator stage's readings: review mass and intake, each with its multiplier (0.2.29+). */
  regulators?: RegulatorReading[];
  /** What the run ran on: the strategy docs' hash and the course's content version. */
  versions?: RunVersions;
}

/** A card as persisted on a run. `origin` is as counted in `newSelected`/`reviewsSelected`. */
export interface StudySessionRunCard {
  cardId: string;
  /**
   * `'review'`: a scheduled review. `'new'`: anything else. `'unknown'` only on
   * older runs, which counted prescribed and hint-required cards as neither.
   */
  origin: 'new' | 'review' | 'unknown';
  /**
   * The strategy that produced the card. Absent if a hint injected it (older
   * runs name the hint here instead).
   */
  generator?: string;
  /** The hint that made the card mandatory, if one did. Its source, over `generator`. */
  required?: string;
  /** Final score; null for a mandatory (required) card, whose score is infinite. */
  score: number | null;
  selected: boolean;
}

/**
 * A card plus the provenance entries that changed its score, in order.
 * `'passed'` entries are dropped. Strategy ids are dropped (the name is kept).
 */
export interface StudySessionRunCardTrail extends StudySessionRunCard {
  trail: Array<{
    strategyName: string;
    action: StrategyContribution['action'];
    score: number;
    reason: string;
  }>;
}

/**
 * One learner↔card ELO exchange, captured at the moment it resolved so a
 * session can be read as an ELO ledger (why did 88% accuracy net -1?). The
 * exchange is otherwise write-once-and-discard: only the updated aggregates
 * survive on the user/card docs, and ELO is path-dependent, so a response's
 * move can't be reconstructed after the fact. Joins to a `CardRecord` by
 * `cardId` + nearest `at`.
 */
export interface SessionEloEvent {
  /** Card this exchange was for. */
  cardId: string;
  /** ISO time the exchange resolved (fires just after the response record). */
  at: string;
  /**
   * Global performance in [0,1] that drove the update. Note this is the ELO
   * `userScore`, not raw correctness: the numeric path maps a correct answer
   * to `0.5 + performance/2` (so a plain correct is 1.0, a graded-correct
   * less) and a miss to 0; the tagged path uses `_global`.
   */
  userScore: number;
  /** Learner global ELO before → after this response. */
  global: { before: number; after: number };
  /** Card global ELO before → after (absent if the card ELO was unreadable). */
  card?: { before: number; after: number };
  /**
   * Per-tag learner ELO before → after, for every tag the exchange touched.
   * `score` is the per-tag performance applied, or null for a count-only
   * exposure tag (`gpc:expose:*`) that increments count without moving ELO.
   */
  tags?: Record<string, { before: number; after: number; score: number | null }>;
}

/**
 * Host-defined learner state at a session boundary. Keep it thin — this is
 * written on every session, and the deltas between consecutive snapshots are
 * what it's read for.
 */
export type SessionStateSnapshot = Record<string, unknown>;

/**
 * Invoked at session open and close. Errors and slow calls are absorbed by
 * the controller.
 */
export type SessionStateSnapshotProvider = (
  phase: 'start' | 'end'
) => SessionStateSnapshot | Promise<SessionStateSnapshot>;

/** Stable across the open and close writes, unlike a timestamp-keyed id. */
export function makeStudySessionId(
  courseId: string,
  userId: string,
  sessionId: string
): string {
  return `${DocTypePrefixes[DocType.STUDY_SESSION]}::${courseId}::${userId}::${sessionId}`;
}

export function newSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
