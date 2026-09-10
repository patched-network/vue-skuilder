import { DocType, DocTypePrefixes } from './types-legacy';
import type { ReplanHints } from '../navigators/generators/types';
import type { GeneratorSummary, FilterImpact } from '../navigators/PipelineDebugger';

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
