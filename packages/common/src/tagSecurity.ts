// ============================================================================
// TAG SECURITY
// ============================================================================
//
// Reads a learner's per-tag presentation buffer (`EloRank.recent`) and says,
// per tag, whether the skill is secure: reliably right on first attempts,
// across more than one day. A consumer policy over the buffer, kept pure and
// generic: the caller picks the tags (a selector) and the thresholds.
//
// Three states:
// - `unproven`: too little evidence to judge. Fewer than `minAttempts` first
//   attempts, or the right ones fall on fewer than `minDays` local days.
// - `shaky`: enough evidence, and it's poor. Right on less than `minAccuracy`
//   of the last min(n, `window`) first attempts.
// - `secure`: otherwise.
//
// Why these defaults: a short window can't separate a learner's typical
// skills from their weak ones. At 83% true accuracy, "5 of the last 6" flags a
// skill as shaky 27% of the time by chance; "75% of the last 12" flags it 13%
// of the time, and a 60% skill 77% of the time.
//
// Correctness is per tag (`presentationOk`), not the card's: a card that
// exercises several tags may be wrong on one and right on the rest, and an
// assisted answer is not evidence of security.
//
// ============================================================================

import type { CourseElo, EloRank, TagPresentation } from './elo.js';
import { tagRole, type TagRole } from './tagRoles.js';

/**
 * A tag's performance must exceed this for the presentation to count as
 * right on that tag. Convention for questions reporting per-tag performance:
 * a miss scores 0, an assisted answer at most this, an unassisted right
 * answer above it.
 */
export const TAG_OK_MIN_PERF = 0.5;

/** Which tags a reader considers. Shared shape for skill-level readers. */
export interface TagSelector {
  /** Tag roles to include (tagRoles.ts). Default `['exercise']`. */
  roles?: TagRole[];
  /** Keep only tags starting with one of these prefixes. */
  include?: string[];
  /** Drop tags starting with any of these prefixes. */
  exclude?: string[];
}

export interface TagSecurityConfig {
  /** First attempts needed before a tag is judged at all. Default 6. */
  minAttempts?: number;
  /** How many of the most recent first attempts the accuracy is read over. Default 12. */
  window?: number;
  /** Accuracy over the window needed to be secure, 0–1. Default 0.75. */
  minAccuracy?: number;
  /** Distinct local days the right answers must fall on. Default 2. */
  minDays?: number;
  /**
   * Local-day key for a presentation's ISO timestamp. Default: the runtime's
   * own time zone (the device's, in a browser), as `YYYY-MM-DD`.
   */
  dayOf?: (at: string) => string;
}

export type TagSecurityStatus = 'secure' | 'shaky' | 'unproven';

export interface TagSecurity {
  tag: string;
  status: TagSecurityStatus;
  /** First attempts in the buffer. */
  attempts: number;
  /** Of the last min(attempts, window), how many were right. */
  right: number;
  /** right / min(attempts, window); 0 when there are none. */
  accuracy: number;
  /** Distinct local days the right answers in the window fall on. */
  days: number;
}

export interface CourseSecurity {
  tags: TagSecurity[];
  secure: number;
  shaky: number;
  unproven: number;
  /** unproven + shaky: met, not yet secure. */
  debt: number;
}

const DEFAULTS = {
  minAttempts: 6,
  window: 12,
  minAccuracy: 0.75,
  minDays: 2,
};

function localDay(at: string): string {
  const d = new Date(at);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Whether a presentation was right on its tag. Uses the recorded per-tag
 * `tagOk` when present; older entries fall back to their performance.
 */
export function presentationOk(entry: TagPresentation): boolean {
  if (typeof entry.tagOk === 'boolean') return entry.tagOk;
  return entry.perf > TAG_OK_MIN_PERF;
}

/** Security of one tag from its rank (absent rank: unproven, no evidence). */
export function tagSecurity(
  tag: string,
  rank: EloRank | undefined,
  config: TagSecurityConfig = {}
): TagSecurity {
  const { minAttempts, window, minAccuracy, minDays } = { ...DEFAULTS, ...config };
  const dayOf = config.dayOf ?? localDay;
  const recent = rank?.recent ?? [];
  const recentWindow = recent.slice(-window);
  const okEntries = recentWindow.filter(presentationOk);
  const accuracy = recentWindow.length ? okEntries.length / recentWindow.length : 0;
  const days = new Set(okEntries.map((e) => dayOf(e.at))).size;

  let status: TagSecurityStatus;
  if (recent.length < minAttempts) status = 'unproven';
  else if (accuracy < minAccuracy) status = 'shaky';
  else if (days < minDays) status = 'unproven';
  else status = 'secure';

  return { tag, status, attempts: recent.length, right: okEntries.length, accuracy, days };
}

/** Whether a tag passes a selector. */
export function selectsTag(tag: string, selector: TagSelector = {}): boolean {
  const roles = selector.roles ?? ['exercise'];
  const role = tagRole(tag);
  if (role === null || !roles.includes(role)) return false;
  if (selector.include?.length && !selector.include.some((p) => tag.startsWith(p))) return false;
  if (selector.exclude?.some((p) => tag.startsWith(p))) return false;
  return true;
}

/**
 * Security of every selected tag the learner has met (count > 0), with
 * totals. A met tag with no buffer (graded before the buffer existed, and not
 * since) is unproven: there is no recent evidence either way.
 */
export function courseSecurity(
  elo: CourseElo,
  options: { selector?: TagSelector; config?: TagSecurityConfig } = {}
): CourseSecurity {
  const tags: TagSecurity[] = [];
  for (const [tag, rank] of Object.entries(elo.tags)) {
    if (!rank || rank.count <= 0 || !selectsTag(tag, options.selector)) continue;
    tags.push(tagSecurity(tag, rank, options.config));
  }
  const count = (s: TagSecurityStatus) => tags.filter((t) => t.status === s).length;
  const secure = count('secure');
  const shaky = count('shaky');
  const unproven = count('unproven');
  return { tags, secure, shaky, unproven, debt: shaky + unproven };
}
