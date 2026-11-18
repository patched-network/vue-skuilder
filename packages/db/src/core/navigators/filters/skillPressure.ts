import {
  courseSecurity,
  skillNeed,
  type CourseElo,
  type SkillNeedConfig,
  type TagSecurityConfig,
  type TagSecurityStatus,
} from '@vue-skuilder/common';
import type { CourseDBInterface } from '../../interfaces/courseDB';
import type { UserDBInterface } from '../../interfaces/userDB';
import type { ContentNavigationStrategyData } from '../../types/contentNavigationStrategy';
import { ContentNavigator } from '../index';
import type { WeightedCard } from '../index';
import type { GeneratorResult } from '../generators/types';
import type { CardFilter, FilterContext, FilterKind } from './types';

// ============================================================================
// SKILL PRESSURE FILTER
// ============================================================================
//
// Leans selection toward the learner's weakest skills: a card exercising a
// skill under pressure gets a small, bounded boost. "Which skill", kept
// separate from ELO distance's "what difficulty", so each is its own line in
// a card's provenance.
//
// A skill's pressure (0–1) is the larger of:
// - need (common/skillNeed): how far its rating sits below the median of the
//   learner's skills;
// - insecurity (common/tagSecurity), when enabled: a fixed weight for a met
//   skill that is shaky (right too rarely lately) or unproven (too little
//   recent evidence). This is what works down the insecure count a course may
//   gate new material on; need alone misses skills rated near the median but
//   missed lately, and skills with too few responses to rate.
//
// multiplier = 1 + gain · (the card's highest skill pressure). The max over a
// card's tags, never the product, so a card naming several weak skills isn't
// boosted several times.
//
// Acts on the whole heap, reviews included: its first effect under a review
// backlog is on *which* reviews are served. A boost can't bring a card that no
// generator retrieved; retrieval of a weak skill's unseen cards is a
// generator's job.
//
// A `signal`. Not added by default: it re-weights every candidate, so a course
// opts in with a `skillPressure` strategy doc (serializedData: a
// SkillPressureConfig as JSON, or empty for the defaults).
//
// ============================================================================

export interface SkillPressureConfig extends SkillNeedConfig {
  /** Boost at pressure 1: multiplier = 1 + gain · pressure. Default 0.5 (cap ×1.5). */
  gain?: number;
  /**
   * Insecurity as pressure. `false` turns it off (need only). Weights are
   * need-equivalents, 0–1. Default: shaky 0.8, unproven 0.5. Uses the same
   * tag selector as need.
   */
  security?:
    | false
    | {
        shaky?: number;
        unproven?: number;
        /** Thresholds for secure / shaky / unproven. Default: the framework's. */
        config?: TagSecurityConfig;
      };
}

const DEFAULT_GAIN = 0.5;
const DEFAULT_SECURITY_WEIGHTS: Record<Exclude<TagSecurityStatus, 'secure'>, number> = {
  shaky: 0.8,
  unproven: 0.5,
};

interface SkillPressureEntry {
  pressure: number;
  why: string;
}

/** Pressure per skill tag for this learner; tags under no pressure are absent. */
export function skillPressures(
  elo: CourseElo,
  config: SkillPressureConfig = {}
): Map<string, SkillPressureEntry> {
  const out = new Map<string, SkillPressureEntry>();
  const raise = (tag: string, pressure: number, why: string): void => {
    if (pressure <= 0) return;
    const prev = out.get(tag);
    if (!prev || pressure > prev.pressure) out.set(tag, { pressure, why });
  };

  for (const s of skillNeed(elo, config).skills) {
    raise(s.tag, s.need, `need ${s.need.toFixed(2)} (${Math.round(s.deficit)} below the skill median)`);
  }

  if (config.security !== false) {
    const weights = { ...DEFAULT_SECURITY_WEIGHTS, ...(config.security ?? {}) };
    const { include, exclude, roles } = config;
    const security = courseSecurity(elo, {
      selector: { include, exclude, roles },
      config: config.security ? config.security.config : undefined,
    });
    for (const s of security.tags) {
      if (s.status === 'secure') continue;
      const n = Math.min(s.attempts, 12);
      raise(
        s.tag,
        weights[s.status],
        s.status === 'shaky' ? `shaky (${s.right}/${n} right)` : `unproven (${s.attempts} recent attempts)`
      );
    }
  }
  return out;
}

async function applySkillPressure(
  cards: WeightedCard[],
  context: FilterContext,
  config: SkillPressureConfig,
  source: { name: string; strategyId: string }
): Promise<WeightedCard[]> {
  if (!context.userCourseElo) return cards;
  const pressures = skillPressures(context.userCourseElo, config);
  if (pressures.size === 0) return cards;
  const gain = config.gain ?? DEFAULT_GAIN;

  return cards.map((card) => {
    let top: { tag: string; entry: SkillPressureEntry } | null = null;
    for (const tag of card.tags ?? []) {
      const entry = pressures.get(tag);
      if (entry && (!top || entry.pressure > top.entry.pressure)) top = { tag, entry };
    }
    if (!top) return card;

    const multiplier = 1 + gain * top.entry.pressure;
    const score = card.score * multiplier;
    return {
      ...card,
      score,
      provenance: [
        ...card.provenance,
        {
          strategy: 'skillPressure',
          strategyName: source.name,
          strategyId: source.strategyId,
          action: 'boosted',
          score,
          reason: `skill pressure: ${top.tag} ${top.entry.why} → ×${multiplier.toFixed(2)}`,
        },
      ],
    };
  });
}

/**
 * The skill pressure filter as a strategy-doc navigator (`implementingClass:
 * 'skillPressure'`, serializedData: a SkillPressureConfig as JSON, or empty).
 */
export default class SkillPressureFilter extends ContentNavigator implements CardFilter {
  name: string;
  /** See CardFilter.kind. Static, so the pipeline plan can read it without an instance. */
  static readonly kind: FilterKind = 'signal';
  readonly kind = SkillPressureFilter.kind;
  private config: SkillPressureConfig;

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ) {
    super(user, course, strategyData);
    this.name = strategyData.name || 'Skill Pressure';
    let parsed: SkillPressureConfig = {};
    try {
      parsed = strategyData.serializedData ? JSON.parse(strategyData.serializedData) : {};
    } catch {
      parsed = {};
    }
    this.config = parsed;
  }

  transform(cards: WeightedCard[], context: FilterContext): Promise<WeightedCard[]> {
    return applySkillPressure(cards, context, this.config, {
      name: this.name,
      strategyId: this.strategyId || 'NAVIGATION_STRATEGY-skillPressure',
    });
  }

  async getWeightedCards(_limit: number): Promise<GeneratorResult> {
    throw new Error(
      'SkillPressureFilter is a filter and should not be used as a generator. ' +
        'Use Pipeline with a generator and this filter via transform().'
    );
  }
}
