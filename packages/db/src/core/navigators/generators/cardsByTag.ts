import type { CourseDBInterface } from '../../interfaces/courseDB';
import { logger } from '@db/util/logger';

// ============================================================================
// TAG → CARD IDS
// ============================================================================
//
// The course's tag docs as a map of tag name → tagged card ids, shared by the
// generators that fetch by tag (prescribed, and the ELO generator's skill
// fetch). Read once per course DB instance and kept for the same five minutes
// as the cached navigator, so a content deploy is picked up on the same
// schedule as before. A failed read is not cached: the next call retries.
//
// ============================================================================

const TTL_MS = 5 * 60 * 1000;

const cache = new WeakMap<
  CourseDBInterface,
  { loadedAt: number; cardsByTag: Promise<Map<string, string[]>> }
>();

/** Tag name → tagged card ids for this course. Callers must not mutate the arrays. */
export function loadCardsByTag(course: CourseDBInterface): Promise<Map<string, string[]>> {
  const hit = cache.get(course);
  if (hit && Date.now() - hit.loadedAt < TTL_MS) return hit.cardsByTag;

  const cardsByTag = course
    .getCourseTagStubs()
    .then((docs) => {
      const out = new Map<string, string[]>();
      for (const row of docs.rows ?? []) {
        const tagDoc = row.doc as { name?: string; taggedCards?: string[] } | undefined;
        if (tagDoc?.name && Array.isArray(tagDoc.taggedCards)) {
          out.set(tagDoc.name, [...tagDoc.taggedCards]);
        }
      }
      return out;
    })
    .catch((e) => {
      if (cache.get(course)?.cardsByTag === cardsByTag) cache.delete(course);
      logger.debug(`[CardsByTag] Failed to load tag docs: ${e}`);
      return new Map<string, string[]>();
    });
  cache.set(course, { loadedAt: Date.now(), cardsByTag });
  return cardsByTag;
}
