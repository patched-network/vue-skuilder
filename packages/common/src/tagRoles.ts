// ============================================================================
// TAG ROLES
// ============================================================================
//
// A framework convention for what a tag records about a learner. The role is
// a colon-delimited segment with more after it: `expose:x`, or namespaced,
// `gpc:expose:x`. The leftmost role segment wins.
//
// - `exercise`: a graded skill. Responses move its ELO.
// - `expose`: bookkeeping. The learner was shown it, but not tested on it.
// - `intro`: bookkeeping. The learner was introduced to it.
//
// Bookkeeping roles are count-only: a response increments the learner's count
// on the tag and never moves an ELO, the learner's or the card's, whatever
// score a question sends. Tags without a role are graded.
//
// ============================================================================

export const TAG_ROLES = ['intro', 'exercise', 'expose'] as const;

export type TagRole = (typeof TAG_ROLES)[number];

const ROLE_SEGMENT = /(^|:)(intro|exercise|expose):(?=.)/;

/** The tag's role, or null if it has none. */
export function tagRole(tag: string): TagRole | null {
  const match = ROLE_SEGMENT.exec(tag);
  return match ? (match[2] as TagRole) : null;
}

/** Whether the tag is bookkeeping (`intro` or `expose`): counted, never graded. */
export function isCountOnlyTag(tag: string): boolean {
  const role = tagRole(tag);
  return role === 'intro' || role === 'expose';
}

/**
 * The same tag with its role swapped, e.g. `gpc:intro:x` → `gpc:expose:x`.
 * Null if the tag has no role.
 */
export function withTagRole(tag: string, role: TagRole): string | null {
  const match = ROLE_SEGMENT.exec(tag);
  if (!match) return null;
  const start = match.index + match[1].length;
  return tag.slice(0, start) + role + tag.slice(start + match[2].length);
}
