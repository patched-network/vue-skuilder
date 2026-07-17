// ============================================================================
// STRATEGY PRESSURE DEBUGGER
// ============================================================================
//
// A generic, semi-structured capture channel for the backpressures that
// navigation strategies exert on the pipeline — the general-purpose sibling
// of SrsDebugger's bespoke review-backlog capture.
//
// Any strategy (built-in or consumer-registered via `registerNavigator`) may
// push a snapshot of its current pressure state once per run. The live
// session overlay renders every captured source in a "strategy backpressure"
// section without knowing producer semantics: each snapshot is a list of
// *gauges* — named multipliers, optionally capped, with human-readable detail
// and expandable item lists (blocked targets, per-tag debt ages, ...).
//
// Mirrors SrsDebugger's lifecycle: latest snapshot per (source, course) wins;
// the controller reads via getDebugSnapshot() with no DB load; cleared on
// session start alongside the pipeline run history.
//
// ============================================================================

/**
 * A single named pressure reading. The common shape across strategies: a
 * multiplier that climbs under some accumulated condition (staleness, debt,
 * blockage), optionally clamped at a cap.
 */
export interface PressureGaugeDebug {
  /** Stable identifier within the source (e.g. 'group:intro-core:target'). */
  id: string;
  /** Short display label (e.g. 'intro-core targets'). */
  label: string;
  /** Current pressure multiplier (×1.0 = no pressure). */
  multiplier: number;
  /** Clamp ceiling, if the multiplier is capped. Omit for unbounded. */
  max?: number;
  /** One-line context for the reading (counts, mode, staleness). */
  detail?: string;
  /** Expandable rows (blocked target ids, per-tag debt ages, ...). */
  items?: Array<{ label: string; value?: string }>;
}

/** One strategy's pressure snapshot for one course, captured once per run. */
export interface StrategyPressureDebug {
  /** Producer identity — implementingClass name (e.g. 'prescribed'). */
  source: string;
  courseId: string;
  gauges: PressureGaugeDebug[];
  /**
   * Highest score this strategy emitted into the candidate pool this run;
   * null if it emitted nothing. Compare against the supplyQ head score to
   * read how the pressure is competing for slots (same crossover read as the
   * SRS panel's `top review`).
   */
  topScore?: number | null;
  /** Label of any one-shot hints emitted alongside the cards this run. */
  hintsLabel?: string;
  /** Epoch ms of capture. */
  timestamp: number;
}

const snapshots = new Map<string, StrategyPressureDebug>();

/** Called by a strategy once per run. Latest snapshot per (source, course) wins. */
export function captureStrategyPressure(snapshot: StrategyPressureDebug): void {
  snapshots.set(`${snapshot.source}:${snapshot.courseId}`, snapshot);
}

/** Current pressure snapshot for every source seen, newest-first. */
export function getStrategyPressureDebug(): StrategyPressureDebug[] {
  return [...snapshots.values()].sort((a, b) => b.timestamp - a.timestamp);
}

/** Drop all captured snapshots (called on session start, alongside pipeline history). */
export function clearStrategyPressureDebug(): void {
  snapshots.clear();
}
