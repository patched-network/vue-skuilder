// ============================================================================
// SRS BACKLOG DEBUGGER
// ============================================================================
//
// A tiny module-level capture of the SRS generator's per-run backlog state,
// so the live session overlay can show whether reviews being out-competed by
// (boosted) new cards is *temporary* (the backlog multiplier still has headroom
// to climb and lift reviews) or *boost-driven* (the multiplier is maxed and the
// new-card boosts simply sit higher — only a hint relaxation reorders them).
//
// Mirrors MixerDebugger/PipelineDebugger: the generator pushes a snapshot each
// run (keyed by course, latest wins); the overlay reads it via the controller's
// getDebugSnapshot(). No DB load on the read path.
//
// ============================================================================

/** Per-course snapshot of SRS backlog state, captured on each SRS generator run. */
export interface SrsBacklogDebug {
  courseId: string;
  /** Total reviews scheduled for this course (due + not-yet-due). */
  scheduledTotal: number;
  /** Reviews eligible (due) right now. */
  dueNow: number;
  /** Healthy backlog threshold; multiplier is ×1.0 at or below this. */
  healthyBacklog: number;
  /** Global multiplier applied to every due review's urgency this run (1.0 → max). */
  backlogMultiplier: number;
  /** Max achievable backlog multiplier (the cap), for headroom context. */
  maxBacklogMultiplier: number;
  /** Highest review score produced this run (post-multiplier; can exceed 1.0); null if none due. */
  topReviewScore: number | null;
  /** Human-readable time until the next review comes due, or null if some are due now. */
  nextDueIn: string | null;
  /** Epoch ms of capture. */
  timestamp: number;
}

const snapshots = new Map<string, SrsBacklogDebug>();

/** Called by the SRS generator once per run. Latest snapshot per course wins. */
export function captureSrsBacklog(snapshot: SrsBacklogDebug): void {
  snapshots.set(snapshot.courseId, snapshot);
}

/** Current backlog snapshot for every course seen, newest-first. */
export function getSrsBacklogDebug(): SrsBacklogDebug[] {
  return [...snapshots.values()].sort((a, b) => b.timestamp - a.timestamp);
}

/** Drop all captured snapshots (called on session start, alongside pipeline history). */
export function clearSrsBacklogDebug(): void {
  snapshots.clear();
}
