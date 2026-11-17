// ============================================================================
// SKILL NEED
// ============================================================================
//
// Which of a learner's skills are furthest behind their others, as a 0–1
// need per skill. Read by selection (skill pressure, by-skill retrieval) and
// by diagnostics, so what selection leans toward is visible.
//
//   skills    = selected tags with a real rating and count >= minCount
//   reference = median rating over skills (the learner's own, not global:
//               a skill's standing against global swings as global moves)
//   deficit   = reference − rating
//   need      = clamp(deficit / scale, 0, 1)
//
// Fewer than `minSkills` qualifying skills: no reference and no need. That
// keeps readers inert for courses without graded skill tags.
//
// A tag's rating starts at the learner's global on first grading and moves
// fast over its first responses, so it says little before `minCount`. Skills
// below that are left to other mechanisms (e.g. prescribed practice debt).
//
// ============================================================================

import { COUNT_ONLY_SCORE, type CourseElo } from './elo.js';
import { isCountOnlyTag } from './tagRoles.js';
import { selectsTag, type TagSelector } from './tagSecurity.js';

export interface SkillNeedConfig extends TagSelector {
  /** Graded responses a tag needs before its rating counts. Default 8. */
  minCount?: number;
  /** ELO points of deficit that make need 1. Default 150. */
  scale?: number;
  /** Fewer qualifying skills than this: no need for any. Default 5. */
  minSkills?: number;
}

export interface SkillNeedRow {
  tag: string;
  rating: number;
  count: number;
  /** reference − rating: positive = behind the learner's other skills. */
  deficit: number;
  /** 0–1. */
  need: number;
}

export interface SkillNeed {
  /** Median rating over qualifying skills; null when there are too few. */
  reference: number | null;
  /** Qualifying skills, neediest first. Empty when reference is null. */
  skills: SkillNeedRow[];
}

const DEFAULTS = { minCount: 8, scale: 150, minSkills: 5 };

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function skillNeed(elo: CourseElo, config: SkillNeedConfig = {}): SkillNeed {
  const { minCount, scale, minSkills } = { ...DEFAULTS, ...config };
  const qualifying = Object.entries(elo.tags).filter(
    ([tag, rank]) =>
      rank &&
      rank.score !== COUNT_ONLY_SCORE &&
      !isCountOnlyTag(tag) &&
      rank.count >= minCount &&
      selectsTag(tag, config)
  );
  if (qualifying.length < minSkills) return { reference: null, skills: [] };

  const reference = median(qualifying.map(([, rank]) => rank.score));
  const skills = qualifying
    .map(([tag, rank]) => {
      const deficit = reference - rank.score;
      return {
        tag,
        rating: rank.score,
        count: rank.count,
        deficit,
        need: Math.min(1, Math.max(0, deficit / scale)),
      };
    })
    .sort((a, b) => b.need - a.need || b.deficit - a.deficit || a.tag.localeCompare(b.tag));
  return { reference, skills };
}
