import type { CourseSlice, LearnerDump } from './dataset';

type RawDoc = { _id: string; [key: string]: unknown };

export type CouchAuth =
  | { kind: 'basic'; username: string; password: string }
  /** Browser: the signed-in admin's couch session cookie. */
  | { kind: 'cookie' };

export interface FetchLearnerDumpOptions {
  /** Couch base URL, e.g. `https://example.com/couch`. */
  couchUrl: string;
  username: string;
  courseId: string;
  auth: CouchAuth;
  /** Course-DB slice to include. Default `touched`. */
  cards?: 'touched' | 'all' | 'none';
  /** Inline user-DB attachments as base64. Default false. */
  attachments?: boolean;
  /** Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

/** couch_peruser convention: `userdb-` + lowercase hex of the username's UTF-8 bytes. */
export function userDbName(username: string): string {
  let hex = '';
  for (const b of new TextEncoder().encode(username)) hex += b.toString(16).padStart(2, '0');
  return 'userdb-' + hex;
}

function base64(s: string): string {
  let binary = '';
  for (const b of new TextEncoder().encode(s)) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** A tiny read-only couch client. No Pouch, no user object, no sync. */
function couchReader(opts: FetchLearnerDumpOptions) {
  const doFetch = opts.fetchImpl ?? fetch;
  const base = opts.couchUrl.replace(/\/+$/, '');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.auth.kind === 'basic') {
    headers.Authorization = 'Basic ' + base64(`${opts.auth.username}:${opts.auth.password}`);
  }
  const credentials: RequestCredentials | undefined =
    opts.auth.kind === 'cookie' ? 'include' : undefined;

  async function get<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const res = await doFetch(`${base}/${path}`, {
      method: init.method ?? 'GET',
      headers: init.body ? { ...headers, 'Content-Type': 'application/json' } : headers,
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
      ...(credentials ? { credentials } : {}),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`[diagnostics] ${init.method ?? 'GET'} ${path} -> ${res.status} ${detail}`);
    }
    return (await res.json()) as T;
  }

  async function byKeys(db: string, keys: string[]): Promise<RawDoc[]> {
    const out: RawDoc[] = [];
    const CHUNK = 500;
    for (let i = 0; i < keys.length; i += CHUNK) {
      const body = await get<{ rows: Array<{ doc?: RawDoc | null }> }>(
        `${db}/_all_docs?include_docs=true`,
        { method: 'POST', body: { keys: keys.slice(i, i + CHUNK) } }
      );
      for (const row of body.rows) if (row.doc) out.push(row.doc);
    }
    return out;
  }

  async function byPrefix(db: string, prefix: string): Promise<RawDoc[]> {
    const q = new URLSearchParams({
      include_docs: 'true',
      startkey: JSON.stringify(prefix),
      endkey: JSON.stringify(prefix + '￰'),
    });
    const body = await get<{ rows: Array<{ doc?: RawDoc }> }>(`${db}/_all_docs?${q}`);
    return body.rows.map((r) => r.doc).filter((d): d is RawDoc => !!d);
  }

  return { base, get, byKeys, byPrefix };
}

/** Card ids the user has any trace of: history, pending schedule, or session ELO events. */
function touchedCardIds(docs: RawDoc[]): string[] {
  const ids = new Set<string>();
  for (const d of docs) {
    if (d._id.startsWith('cardH') && typeof d.cardID === 'string') ids.add(d.cardID);
    else if (d._id.startsWith('card_review_') && typeof d.cardId === 'string') ids.add(d.cardId);
    else if (d._id.startsWith('SESSION::') && Array.isArray(d.eloEvents)) {
      for (const e of d.eloEvents as Array<{ cardId?: string }>) if (e.cardId) ids.add(e.cardId);
    }
  }
  return [...ids];
}

/**
 * Read one learner's records for one course into a {@link LearnerDump}: the
 * whole user DB, its tombstones, and (by default) the course cards the user
 * has touched, with their displayable data and tags. Needs admin rights on
 * the couch, via basic auth or the browser's session cookie.
 */
export async function fetchLearnerDump(opts: FetchLearnerDumpOptions): Promise<LearnerDump> {
  const couch = couchReader(opts);
  const dbName = userDbName(opts.username);
  const fetchedAt = new Date().toISOString();

  const info = await couch.get<unknown>(dbName);

  const q = new URLSearchParams({ include_docs: 'true' });
  if (opts.attachments) q.set('attachments', 'true');
  const all = await couch.get<{ rows: Array<{ doc?: RawDoc }> }>(`${dbName}/_all_docs?${q}`);
  const docs = all.rows.map((r) => r.doc).filter((d): d is RawDoc => !!d);

  const changes = await couch.get<{
    results: Array<{
      id: string;
      seq: string | number;
      deleted?: boolean;
      changes: Array<{ rev: string }>;
    }>;
  }>(`${dbName}/_changes?style=main_only`);
  const tombstones = changes.results
    .filter((c) => c.deleted)
    .map((c) => ({ id: c.id, rev: c.changes[0]?.rev, seq: Number(String(c.seq).split('-')[0]) }));

  const scope = opts.cards ?? 'touched';
  let course: CourseSlice | undefined;
  if (scope !== 'none') {
    const courseDb = `coursedb-${opts.courseId}`;
    let cards: RawDoc[];
    if (scope === 'all') {
      const found = await couch.get<{ docs: RawDoc[] }>(`${courseDb}/_find`, {
        method: 'POST',
        body: { selector: { docType: 'CARD' }, limit: 1_000_000 },
      });
      cards = found.docs;
    } else {
      cards = await couch.byKeys(courseDb, touchedCardIds(docs));
    }
    const cardIds = new Set(cards.map((c) => c._id));
    const ddIds = new Set<string>();
    for (const c of cards) {
      for (const id of (c.id_displayable_data as string[] | undefined) ?? []) ddIds.add(id);
    }
    const displayableData = await couch.byKeys(courseDb, [...ddIds]);
    const tags = (await couch.byPrefix(courseDb, 'TAG'))
      .map((t) => {
        const tagged = Array.isArray(t.taggedCards) ? (t.taggedCards as string[]) : [];
        return {
          ...t,
          taggedCount: tagged.length,
          taggedCards: scope === 'all' ? tagged : tagged.filter((id) => cardIds.has(id)),
        };
      })
      .filter((t) => scope === 'all' || t.taggedCards.length > 0);

    course = {
      courseId: opts.courseId,
      source: `${couch.base}/${courseDb}`,
      scope,
      cards,
      displayableData,
      tags,
    } as unknown as CourseSlice;
  }

  return {
    formatVersion: 1,
    username: opts.username,
    dbName,
    source: couch.base,
    fetchedAt,
    courseId: opts.courseId,
    info,
    docs,
    tombstones,
    ...(course ? { course } : {}),
  };
}
