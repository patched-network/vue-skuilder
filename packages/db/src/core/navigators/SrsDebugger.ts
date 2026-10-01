// ============================================================================
// SRS BACKLOG DEBUGGER
// ============================================================================
//
// A tiny module-level capture of per-run review backlog state, so the live
// session overlay can show how much runway remains before reviews out-compete
// the current (boosted) new/prescribed cards: the review-mass multiplier is
// exponential and uncapped, so it always has headroom to climb further — the
// question is just how large the backlog's mass needs to get before it crosses
// whatever the competing boosts currently sit at.
//
// The SRS generator captures counts each run; the pipeline's regulator stage
// then patches in the review mass and the multiplier (noteReviewPressure).
// Keyed by course, latest wins; the overlay reads it via the controller's
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
  /** Healthy review mass (card-equivalents); the multiplier is ×1.0 at or below it. */
  healthyBacklog: number;
  /**
   * Review mass: the due reviews' filtered scores against a reference, each at
   * most 1. Set by the regulator stage; null until it has run.
   */
  reviewMass: number | null;
  /** Multiplier the regulator stage applied to every due review this run (>= 1.0, unbounded). */
  backlogMultiplier: number;
  /** Exponential growth-rate base the multiplier climbs by per multiple of healthy mass in excess. */
  backlogGrowthRate: number;
  /** Highest review urgency score from the SRS generator (before filters and regulators); null if none due. */
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

/**
 * Called by the pipeline's regulator stage once per run: the review mass and
 * the multiplier it set. Patches the course's latest SRS snapshot.
 */
export function noteReviewPressure(
  courseId: string,
  pressure: { mass: number; healthyMass: number; rate: number; multiplier: number }
): void {
  const snapshot = snapshots.get(courseId);
  if (!snapshot) return;
  snapshots.set(courseId, {
    ...snapshot,
    reviewMass: pressure.mass,
    healthyBacklog: pressure.healthyMass,
    backlogGrowthRate: pressure.rate,
    backlogMultiplier: pressure.multiplier,
  });
}

/** Current backlog snapshot for every course seen, newest-first. */
export function getSrsBacklogDebug(): SrsBacklogDebug[] {
  return [...snapshots.values()].sort((a, b) => b.timestamp - a.timestamp);
}

/** Drop all captured snapshots (called on session start, alongside pipeline history). */
export function clearSrsBacklogDebug(): void {
  snapshots.clear();
}
