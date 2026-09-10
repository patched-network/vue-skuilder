import { DocType, DocTypePrefixes } from './types-legacy';
import type { ReplanHints } from '../navigators/generators/types';

/**
 * Durable, per-sitting record of a study session.
 *
 * ## Why this exists
 *
 * The framework already minted a session id (`SessionDebugger`) and a run id
 * (`PipelineDebugger`), but both lived in module-level ring buffers that die
 * on page reload. Nothing persisted carried either one, so the only durable
 * trace of a session was a scatter of `CardRecord`s inside per-card `cardH-*`
 * docs — recoverable into "one sitting" only by timestamp-gap clustering.
 *
 * This doc makes the session the unit of analysis: it is the join target for
 * `CardRecord.sessionId`, and it carries the things a card record cannot —
 * what the session was *configured* to do, what the pipeline actually did,
 * and what the learner's state looked like on either side of it.
 *
 * ## Written twice: open, then closed
 *
 * `SessionController.prepareSession()` writes it with `status: 'open'`;
 * termination overwrites it as `closed` (ran out) or `abandoned` (navigated
 * away), and a doc still reading `open` means the tab went away before either
 * could run. Recording all three is the point: the prior design wrote nothing
 * until the end, and additionally bailed on sessions with no question
 * records, so a learner quitting early left no trace at all.
 *
 * ## Scope
 *
 * Deliberately small and bounded. Per-card detail belongs in the `cardH-*`
 * records that point back here; full pipeline provenance stays in the
 * in-memory debugger. What lands here is the per-run *summary* and a thin
 * state snapshot — enough to ask "given this state, what did the navigator
 * choose, and did the sitting go well?" without the doc growing with session
 * length.
 */
export interface StudySessionDoc {
  /** `SESSION::{courseId}::{userId}::{sessionId}` — see {@link makeStudySessionId}. */
  _id: string;
  _rev?: string;
  docType: DocType.STUDY_SESSION;

  /**
   * The session identity, also stamped onto every `CardRecord` produced
   * during the session. Format: `session-{epochMs}-{rand}`.
   */
  sessionId: string;
  courseId: string;
  userId: string;

  /** ISO. Session construction time, not first-card time. */
  startTime: string;
  /** ISO. Absent while `status === 'open'`. */
  endTime?: string;

  /**
   * How the session ended — the three cases are worth separating:
   *
   * - `closed` — ran to a natural termination (timer expired, or content
   *   exhausted). The only "complete" outcome.
   * - `abandoned` — the learner navigated away mid-session. The host tore the
   *   study view down, so there is still a tally and an end-state snapshot;
   *   what's missing is the learner's willingness to finish.
   * - `open` — never closed at all: tab closed, reload, crash. Nothing got a
   *   chance to run, so `tally` and `stateAtEnd` are absent.
   *
   * `open` and `abandoned` are the interesting rows for navigation-strategy
   * work, and both are invisible to a design that only writes at completion.
   */
  status: 'open' | 'closed' | 'abandoned';

  /** Session length in seconds as configured at construction. */
  plannedSeconds: number;

  config: {
    defaultBatchLimit: number;
    /** Number of content sources the controller was constructed over. */
    sourceCount: number;
    /** Session-durable hints in force at session open (e.g. a post-lesson boost). */
    initHints?: ReplanHints | null;
  };

  /** Queue depths after the bootstrap pipeline run, before the first draw. */
  initialQueues: { supplyQ: number; failedQ: number };

  /** Filled at close. */
  tally?: {
    /** Distinct cards presented (a re-presented failed card counts once). */
    cardsPresented: number;
    /** Total responses recorded, including repeat attempts on one card. */
    responses: number;
    correct: number;
    incorrect: number;
    /** Cards still sitting in the remediation queue when the session ended. */
    failedQRemaining: number;
    /** Seconds left on the clock at close; negative-clamped to 0. */
    secondsRemaining: number;
  };

  /**
   * One entry per pipeline run for this session, in execution order —
   * the bootstrap run plus every replan.
   *
   * This is the durable half of what `PipelineDebugger` holds in memory: the
   * *shape* of each decision (how much was generated, how much survived, what
   * the split was) without the per-card provenance trails, which are multi-KB
   * each and belong in the live debugger rather than in a synced doc.
   */
  runs?: StudySessionRunSummary[];

  /** Session-durable hints as they stood at close, after any observer merges. */
  finalHints?: ReplanHints | null;

  /**
   * Host-supplied learner state at session open. See
   * {@link SessionStateSnapshotProvider} for why this is host-shaped.
   */
  stateAtStart?: SessionStateSnapshot;
  /** Host-supplied learner state at close. Diff against `stateAtStart`. */
  stateAtEnd?: SessionStateSnapshot;
}

/** Compact summary of one pipeline run within a session. */
export interface StudySessionRunSummary {
  /** Joins to `PipelineRunReport.runId` while that run is still in memory. */
  runId: string;
  /** ISO. */
  at: string;
  /**
   * Provenance label — `'bootstrap'` for the initial plan, otherwise the
   * replan's label (`'auto:depletion'`, `'auto:quality'`, `'wedge-breaker'`,
   * or a caller-supplied one such as a post-intro follow-up).
   */
  label: string;
  /** `'replace' | 'merge'` for replans; absent for the bootstrap run. */
  mode?: string;
  generatedCount: number;
  finalCount: number;
  reviewsSelected: number;
  newSelected: number;
}

/**
 * A thin, host-defined snapshot of learner state at a session boundary.
 *
 * Free-form on purpose: what constitutes "learner state" is curriculum
 * knowledge the framework does not have. LettersPractice supplies unlocked
 * letters, reachable-word count, ELO, review backlog and lesson progress;
 * another course would supply something else entirely.
 *
 * Keep it *thin*. A full user-state dump (every card history, every scheduled
 * review) is the wrong thing to write per session — it is large, it duplicates
 * docs that already exist, and it grows without bound. The deltas between
 * consecutive sessions' snapshots reconstruct most of what a full dump would
 * give you, at a fraction of the cost.
 */
export type SessionStateSnapshot = Record<string, unknown>;

/**
 * Host hook invoked at session open and again at close.
 *
 * Isolated: a throwing or hanging provider must not wedge a study session, so
 * the controller catches and (at open) time-boxes it — a missing snapshot
 * degrades analysis, never the learner's session.
 */
export type SessionStateSnapshotProvider = (
  phase: 'start' | 'end'
) => SessionStateSnapshot | Promise<SessionStateSnapshot>;

/**
 * Build the doc id. The session id is the last segment (rather than a
 * timestamp, as `USER_OUTCOME` uses) so the id is stable across the open and
 * close writes, and so a `CardRecord.sessionId` resolves to a doc id directly.
 */
export function makeStudySessionId(
  courseId: string,
  userId: string,
  sessionId: string
): string {
  return `${DocTypePrefixes[DocType.STUDY_SESSION]}::${courseId}::${userId}::${sessionId}`;
}

/** Mint a fresh session identity. */
export function newSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
