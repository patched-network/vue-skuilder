import type { WeightedCard } from './index';

// ============================================================================
// REGULATORS  (pipeline stage, after filters, before hints)
// ============================================================================
//
// Review and new cards compete in one ranking. Regulators set the balance
// between the two classes: each valve measures an urgency `u` for its class
// and multiplies that class's scores by `rate^(u / scale)` above a threshold.
// Uncapped on both sides, so neither class can be permanently silenced.
//
// - Review mass: reviews pile up. Measured as the *value* of the due backlog,
//   not its count: each due review weighs its SRS urgency (0–1) times the
//   filters' net effect on it, so the reserve lake of low-value reviews
//   (moved-beyond, long-interval, barely overdue) weighs little. The SRS
//   score itself won't do: it carries a fixed 0.5 ranking offset, so every
//   review would weigh at least ~0.6.
// - Intake: new content stalls. Measured as hours since a new card was last
//   presented, counting only time when an eligible new card existed.
//
// A stage, not a filter: a regulator reads an aggregate of every candidate's
// *final* filtered score, so it must run after all filters (which run in name
// order and are assumed commutative). Before hints, so session intent (an
// intro's follow-up, a difficulty boost) still wins over pressure.
//
// Design note: agent/pipeline-regulation/a.0.regulator-stage.md.
//
// ============================================================================

export type RegulatorName = 'review-mass' | 'intake';

/** One regulator's reading for one pipeline run. Persisted on run summaries. */
export interface RegulatorReading {
  name: RegulatorName;
  /** The class the multiplier applies to. */
  class: 'review' | 'new';
  /** The valve's urgency: review mass (card-equivalents) or intake hours. */
  urgency: number;
  multiplier: number;
  /** Candidates the multiplier applied to. */
  applied: number;
  inputs: Record<string, number>;
}

export interface RegulatorConfig {
  reviewMass: {
    /**
     * Unit of mass for reviews without an SRS urgency (from another
     * generator): a filtered score this high weighs 1.
     */
    referenceScore: number;
    /** Mass (card-equivalents) at or below which there's no pressure. */
    healthyMass: number;
    /** Multiplier growth per multiple of `healthyMass` in excess. */
    rate: number;
  };
  intake: {
    /** Multiplier growth per `scaleHours` without a new card. */
    rate: number;
    scaleHours: number;
  };
}

/**
 * Defaults. Review mass keeps the SRS generator's former healthy threshold and
 * growth rate (20, ×2), now applied to mass instead of count. Intake doubles
 * per day of servable time without a new card.
 */
export const DEFAULT_REGULATOR_CONFIG: RegulatorConfig = {
  reviewMass: { referenceScore: 0.95, healthyMass: 20, rate: 2 },
  intake: { rate: 2, scaleHours: 24 },
};

// ----------------------------------------------------------------------------
// Review mass
// ----------------------------------------------------------------------------

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * One due review's weight in the mass, in [0, 1]: its SRS urgency times the
 * filters' net effect on it (filtered score ÷ the score it was generated
 * with), so every course signal discounts it. A review without an urgency
 * weighs its filtered score against the reference.
 */
export function reviewWeight(
  card: WeightedCard,
  generatedScore: number | undefined,
  referenceScore: number
): number {
  if (card.reviewUrgency !== undefined && generatedScore !== undefined && generatedScore > 0) {
    return clamp01(card.reviewUrgency * (card.score / generatedScore));
  }
  return clamp01(card.score / referenceScore);
}

/**
 * @param reviews - Due reviews, after filters
 * @param generatedScores - Each card's score as generated, before filters
 */
export function reviewMassReading(
  reviews: WeightedCard[],
  generatedScores: ReadonlyMap<string, number>,
  config: RegulatorConfig['reviewMass'] = DEFAULT_REGULATOR_CONFIG.reviewMass
): RegulatorReading {
  const mass = reviews.reduce(
    (m, c) => m + reviewWeight(c, generatedScores.get(c.cardId), config.referenceScore),
    0
  );
  const multiplier =
    mass > config.healthyMass
      ? Math.pow(config.rate, (mass - config.healthyMass) / config.healthyMass)
      : 1;
  return {
    name: 'review-mass',
    class: 'review',
    urgency: mass,
    multiplier,
    applied: reviews.length,
    inputs: { due: reviews.length, mass, healthyMass: config.healthyMass },
  };
}

// ----------------------------------------------------------------------------
// Intake
// ----------------------------------------------------------------------------

/** The intake valve's clock, persisted per user and course (strategy state). */
export interface IntakeClockState {
  /** When a new card was last presented (ISO). */
  lastNewAt: string;
  /** Closed stretches since then during which no eligible new card existed (ms). */
  frozenMs: number;
  /** Start of the current stretch with no eligible new card (ISO), or null. */
  unservableSince: string | null;
}

/** Strategy-state key for the intake clock. */
export const INTAKE_CLOCK_KEY = 'IntakeClock';

/** A fresh clock: a new card was just presented (or the clock is starting). */
export function resetIntakeClock(nowMs: number): IntakeClockState {
  return { lastNewAt: new Date(nowMs).toISOString(), frozenMs: 0, unservableSince: null };
}

/** Frozen time so far, including an open unservable stretch. */
export function frozenMsAt(state: IntakeClockState, nowMs: number): number {
  const open = state.unservableSince ? Math.max(0, nowMs - Date.parse(state.unservableSince)) : 0;
  return state.frozenMs + open;
}

/** Servable hours since a new card was last presented. */
export function intakeHours(state: IntakeClockState, nowMs: number): number {
  const elapsed = nowMs - Date.parse(state.lastNewAt);
  return Math.max(0, elapsed - frozenMsAt(state, nowMs)) / 3_600_000;
}

/**
 * Advance the clock's freeze bookkeeping for a run that found `eligibleNew`
 * eligible new candidates. The clock freezes while there are none (exhaustion
 * isn't starvation) and resumes when some appear. Returns the same object when
 * nothing changed, so callers persist only on transitions.
 */
export function stepIntakeClock(
  state: IntakeClockState,
  nowMs: number,
  eligibleNew: number
): IntakeClockState {
  if (eligibleNew === 0 && !state.unservableSince) {
    return { ...state, unservableSince: new Date(nowMs).toISOString() };
  }
  if (eligibleNew > 0 && state.unservableSince) {
    return { ...state, frozenMs: frozenMsAt(state, nowMs), unservableSince: null };
  }
  return state;
}

export function intakeReading(
  state: IntakeClockState,
  nowMs: number,
  counts: { eligibleNew: number; newCandidates: number },
  config: RegulatorConfig['intake'] = DEFAULT_REGULATOR_CONFIG.intake
): RegulatorReading {
  const hours = intakeHours(state, nowMs);
  const multiplier = counts.eligibleNew > 0 ? Math.pow(config.rate, hours / config.scaleHours) : 1;
  return {
    name: 'intake',
    class: 'new',
    urgency: hours,
    multiplier,
    applied: counts.eligibleNew,
    inputs: {
      hoursSinceNew: hours,
      frozenHours: frozenMsAt(state, nowMs) / 3_600_000,
      eligibleNew: counts.eligibleNew,
      newCandidates: counts.newCandidates,
    },
  };
}

// ----------------------------------------------------------------------------
// Applying
// ----------------------------------------------------------------------------

const REGULATOR_LABEL: Record<RegulatorName, string> = {
  'review-mass': 'Review mass',
  intake: 'Intake',
};

/** Multiply `cards` (in place) by a reading's multiplier, with a provenance entry when it changes them. */
export function applyReading(cards: WeightedCard[], reading: RegulatorReading): void {
  if (reading.multiplier === 1) return;
  const reason =
    reading.name === 'review-mass'
      ? `review mass ${reading.urgency.toFixed(1)} (healthy ${reading.inputs.healthyMass}) → ×${reading.multiplier.toFixed(2)}`
      : `${reading.urgency.toFixed(1)}h since a new card → ×${reading.multiplier.toFixed(2)}`;
  for (const card of cards) {
    card.score *= reading.multiplier;
    card.provenance.push({
      strategy: 'regulator',
      strategyName: `Regulator: ${REGULATOR_LABEL[reading.name]}`,
      strategyId: `regulator-${reading.name}`,
      action: reading.multiplier > 1 ? 'boosted' : 'penalized',
      score: card.score,
      reason,
    });
  }
}
