/**
 * A learner's per-tag ELO, read for display: one row per tag on their course
 * registration, the batches a view filters those rows by, and each rating's
 * trajectory through the dataset's sessions.
 *
 * The source is the learner's `CourseElo` (global + per-tag `{score, count,
 * recent}`). Session `eloEvents` add trajectories (per-tag before → after,
 * from when sessions began recording them); card-history records add when a
 * tag was first and last named by a response.
 */
import {
  COUNT_ONLY_SCORE,
  isCountOnlyTag,
  tagRole,
  type CourseElo,
  type EloRank,
  type TagPresentation,
  type TagRole,
} from '@vue-skuilder/common';
import type { LearnerDataset } from './dataset';

// ============================================================================
// Batches
// ============================================================================

/**
 * A set of tags to view together, as data: every criterion given must hold.
 *
 * Plain data on purpose. Choosing which tags count is the same question the
 * tag-aware ELO distance filter has open (`tagAwareGap` in
 * `filters/eloDistance.ts`); a serializable batch can later move into a
 * strategy config and serve both.
 */
export interface TagBatch {
  id: string;
  label: string;
  /** Tag namespaces (see {@link tagNamespace}); `''` is tags with none. */
  namespaces?: string[];
  /** Tag roles; `'none'` is tags without one. */
  roles?: Array<TagRole | 'none'>;
  /** Tags starting with any of these. */
  prefixes?: string[];
  /** Tags starting with any of these are left out. */
  excludePrefixes?: string[];
}

/** What precedes a tag's role segment: `gpc` in `gpc:exercise:x`, `''` in `expose:x`. */
function beforeRole(tag: string, role: TagRole): string {
  // tagRole takes the leftmost role segment; the leftmost of this one is it.
  const match = new RegExp(`(^|:)${role}:(?=.)`).exec(tag);
  return match ? tag.slice(0, match.index) : '';
}

/**
 * The colon-delimited segments that scope a tag: what comes before its role
 * (`gpc:exercise:x` → `gpc`), else its first segment (`concept:match:x` →
 * `concept`). `''` for a tag with neither (`femur`, `expose:x`).
 */
export function tagNamespace(tag: string): string {
  const role = tagRole(tag);
  if (role) return beforeRole(tag, role);
  const colon = tag.indexOf(':');
  return colon > 0 ? tag.slice(0, colon) : '';
}

export function matchesTagBatch(tag: string, batch: TagBatch, role = tagRole(tag)): boolean {
  if (batch.namespaces && !batch.namespaces.includes(tagNamespace(tag))) return false;
  if (batch.roles && !batch.roles.includes(role ?? 'none')) return false;
  if (batch.prefixes && !batch.prefixes.some((p) => tag.startsWith(p))) return false;
  if (batch.excludePrefixes?.some((p) => tag.startsWith(p))) return false;
  return true;
}

/** The namespace × role batch a tag falls in, e.g. `gpc:exercise`, `concept`, or `(no namespace)`. */
export function tagGroupBatch(tag: string): TagBatch {
  const role = tagRole(tag);
  const ns = tagNamespace(tag);
  const id = [ns, role].filter(Boolean).join(':') || '(no namespace)';
  return { id, label: id, namespaces: [ns], roles: [role ?? 'none'] };
}

// ============================================================================
// Rows
// ============================================================================

export interface TagEloRow {
  tag: string;
  role: TagRole | null;
  namespace: string;
  /** Id of the tag's {@link tagGroupBatch}. */
  group: string;
  /**
   * The learner's rating on the tag. Null for a count-only tag: a bookkeeping
   * role (`intro`, `expose`), or the count-only sentinel.
   */
  score: number | null;
  /**
   * A real score stored on a bookkeeping-role tag, from before roles were
   * count-only. Not a rating: the framework ignores it.
   */
  staleScore?: number;
  count: number;
  /** `score − global`; null when score is. */
  vsGlobal: number | null;
  /** The rating's ring buffer of recent first attempts, oldest first. */
  recent: TagPresentation[];
  /** First-attempt correct entries in `recent`. */
  recentOk: number;
  /** First and last response whose per-tag performance named the tag, or a recent entry. */
  firstSeen: string | null;
  lastSeen: string | null;
  /** ELO events on the tag in the dataset's sessions. */
  events: number;
}

export interface EloPoint {
  at: string;
  score: number;
}

export interface TagEloView {
  global: EloRank;
  /** Every tag on the registration, highest score first, count-only tags last. */
  rows: TagEloRow[];
  /** The namespace × role batches present, graded ones first. */
  groups: TagBatch[];
  /**
   * Ratings through the dataset's ELO events: each series starts at its first
   * event's `before`, has a point per event, and ends at the current score at
   * `asOf`. A move between recorded events (a session that didn't save its
   * events) shows as a step at the next event, or at `asOf`. Tags with no
   * events have no series; count-only tags have none.
   */
  series: { global: EloPoint[]; tags: Record<string, EloPoint[]> };
  /** The first ELO event, or null: trajectories start here. */
  seriesFrom: string | null;
}

/** The learner's `CourseElo` for the dataset's course, or null if not registered. */
export function learnerCourseElo(ds: LearnerDataset): CourseElo | null {
  const elo = ds.registration?.courses?.find((c) => c.courseID === ds.courseId)?.elo;
  if (typeof elo === 'number') return { global: { score: elo, count: 0 }, tags: {}, misc: {} };
  if (!elo || typeof elo !== 'object' || !elo.global) return null;
  return { ...elo, tags: elo.tags ?? {}, misc: elo.misc ?? {} };
}

function minIso(a: string | null, b: string): string {
  return a === null || b < a ? b : a;
}

function maxIso(a: string | null, b: string): string {
  return a === null || b > a ? b : a;
}

/**
 * Extend a series by one event. A `before` that differs from where the line
 * stands gets its own point: the rating moved between recorded events (a
 * session that closed without saving its events), shown as a step here.
 */
function step(line: EloPoint[], at: string, before: number, after: number): void {
  if (before !== COUNT_ONLY_SCORE && line[line.length - 1]?.score !== before)
    line.push({ at, score: before });
  line.push({ at, score: after });
}

/** The learner's per-tag ELO for display. Null if the dataset has no registration for its course. */
export function tagEloView(ds: LearnerDataset): TagEloView | null {
  const elo = learnerCourseElo(ds);
  if (!elo) return null;

  // When each tag was named by a response, from card history.
  const seen = new Map<string, { first: string | null; last: string | null }>();
  for (const h of ds.cardHistories) {
    for (const r of h.records) {
      const p = r.performance as unknown;
      if (!p || typeof p !== 'object') continue;
      for (const tag of Object.keys(p)) {
        if (tag === '_global') continue;
        const s = seen.get(tag) ?? { first: null, last: null };
        s.first = minIso(s.first, r.timeStamp);
        s.last = maxIso(s.last, r.timeStamp);
        seen.set(tag, s);
      }
    }
  }

  // Trajectories, from session ELO events in time order.
  const events = ds.sessions
    .flatMap((s) => s.eloEvents ?? [])
    .sort((a, b) => a.at.localeCompare(b.at));
  const globalSeries: EloPoint[] = [];
  const tagSeries: Record<string, EloPoint[]> = {};
  const eventCounts = new Map<string, number>();
  for (const e of events) {
    step(globalSeries, e.at, e.global.before, e.global.after);
    for (const [tag, t] of Object.entries(e.tags ?? {})) {
      eventCounts.set(tag, (eventCounts.get(tag) ?? 0) + 1);
      if (t.score === null || isCountOnlyTag(tag) || t.after === COUNT_ONLY_SCORE) continue;
      step((tagSeries[tag] ??= []), e.at, t.before, t.after);
    }
  }

  const rows: TagEloRow[] = Object.entries(elo.tags).map(([tag, rank]) => {
    const role = tagRole(tag);
    const countOnly = isCountOnlyTag(tag) || rank.score === COUNT_ONLY_SCORE;
    const score = countOnly ? null : rank.score;
    const recent = rank.recent ?? [];
    let { first, last } = seen.get(tag) ?? { first: null, last: null };
    for (const p of recent) {
      first = minIso(first, p.at);
      last = maxIso(last, p.at);
    }
    return {
      tag,
      role,
      namespace: tagNamespace(tag),
      group: tagGroupBatch(tag).id,
      score,
      ...(countOnly && rank.score !== COUNT_ONLY_SCORE ? { staleScore: rank.score } : {}),
      count: rank.count,
      vsGlobal: score === null ? null : score - elo.global.score,
      recent,
      recentOk: recent.filter((p) => p.ok).length,
      firstSeen: first,
      lastSeen: last,
      events: eventCounts.get(tag) ?? 0,
    };
  });
  rows.sort((a, b) =>
    a.score === null || b.score === null
      ? Number(a.score === null) - Number(b.score === null) || a.tag.localeCompare(b.tag)
      : b.score - a.score || a.tag.localeCompare(b.tag)
  );

  // Close each line at the current rating, so it reaches `asOf` and shows any
  // move the events didn't record.
  if (globalSeries.length > 0) globalSeries.push({ at: ds.asOf, score: elo.global.score });
  for (const row of rows) {
    const line = tagSeries[row.tag];
    if (line && row.score !== null) line.push({ at: ds.asOf, score: row.score });
  }

  const groups = new Map<string, TagBatch>();
  for (const row of rows) if (!groups.has(row.group)) groups.set(row.group, tagGroupBatch(row.tag));
  const countOnlyGroup = (b: TagBatch): boolean =>
    b.roles?.some((r) => r === 'intro' || r === 'expose') ?? false;

  return {
    global: elo.global,
    rows,
    groups: [...groups.values()].sort(
      (a, b) => Number(countOnlyGroup(a)) - Number(countOnlyGroup(b)) || a.id.localeCompare(b.id)
    ),
    series: { global: globalSeries, tags: tagSeries },
    seriesFrom: events[0]?.at ?? null,
  };
}
