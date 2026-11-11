/**
 * User Timing marks for session and sync milestones.
 *
 * Names are `sk:`-prefixed (apps add their own, e.g. LP's `lp:`). Read them with
 * `performance.getEntriesByType('mark' | 'measure')`: synthetic runs (Playwright,
 * Lighthouse's `user-timings`) and, later, real-user measurement.
 *
 * Marks never throw: a missing or partial User Timing API is a no-op.
 */

export function perfMark(name: string, detail?: Record<string, unknown>): void {
  try {
    globalThis.performance?.mark(name, detail ? { detail } : undefined);
  } catch {
    // no User Timing (or no `detail` support): nothing to record
  }
}

/** A measure from `start` (a mark name or a `performance.now()` value) to now or `end`. */
export function perfMeasure(
  name: string,
  start: string | number,
  end?: string | number,
  detail?: Record<string, unknown>
): void {
  try {
    globalThis.performance?.measure(name, {
      start,
      ...(end !== undefined ? { end } : {}),
      ...(detail ? { detail } : {}),
    });
  } catch {
    // unknown start mark, or no User Timing: nothing to record
  }
}
