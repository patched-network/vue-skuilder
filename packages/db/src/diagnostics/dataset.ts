import type {
  CardData,
  CardHistory,
  CardRecord,
  DisplayableData,
  QuestionRecord,
  Tag,
} from '../core/types/types-legacy';
import type { CourseRegistrationDoc, ScheduledCard } from '../core/types/user';
import type { StudySessionDoc } from '../core/types/studySession';
import type { ContentNavigationStrategyData } from '../core/types/contentNavigationStrategy';

// Literal prefixes rather than `DocTypePrefixes`: this entry stays free of
// runtime imports from `core`, so it loads in the browser, node, and the CLI
// without the rest of the db package.
const PREFIX = {
  cardHistory: 'cardH',
  scheduled: 'card_review_',
  session: 'SESSION::',
  strategyState: 'STRATEGY_STATE::',
  registrations: 'CourseRegistrations',
} as const;

type RawDoc = { _id: string; [key: string]: unknown };

/**
 * A learner's raw records, as fetched. This is the on-disk dump format: the
 * `dump-user` CLI writes it, an admin UI can load it from a file, and every
 * loader produces it. Readers must tolerate every past version.
 *
 * - v0 (LP `scripts/dump-user-db.ts` before 2026-09-30): no `formatVersion`,
 *   `courseId`, `tombstones`, or `course`.
 * - v1: adds all four. Later v1 dumps also carry `course.strategies` (optional).
 */
export interface LearnerDump {
  formatVersion?: 1;
  username: string;
  dbName: string;
  /** The couch base URL the records came from. */
  source: string;
  fetchedAt: string;
  courseId?: string;
  /** The couch `GET /{db}` response. */
  info?: unknown;
  /** Every user-DB doc, raw (`_id`/`_rev` kept, `_design` docs included). */
  docs: RawDoc[];
  /**
   * Deleted user-DB docs. Completed reviews are deleted, so deleted
   * `card_review_<reviewTime>` ids are the only record of past due times.
   * `seq` is the numeric prefix of the couch seq: order, not time.
   */
  tombstones?: Array<{ id: string; rev?: string; seq: number }>;
  course?: CourseSlice;
}

export interface CourseSlice {
  courseId: string;
  source?: string;
  /** `touched`: cards the user has history, schedule, or ELO events for. `all`: every card. */
  scope: 'touched' | 'all';
  cards: Array<CardData & { _id: string }>;
  displayableData: Array<DisplayableData & { _id: string }>;
  /**
   * TAG docs. Under `touched`, `taggedCards` is narrowed to the included cards
   * and `taggedCount` keeps the full length.
   */
  tags: Array<Tag & { _id: string; taggedCount: number }>;
  /**
   * The course's NAVIGATION_STRATEGY docs, as they stood when the dump was
   * taken (current state, not as of any session). Absent in older dumps.
   */
  strategies?: ContentNavigationStrategyData[];
}

/** A card-history record with an ISO `timeStamp`. Question fields exist on question records only. */
export type DatasetRecord = Omit<CardRecord, 'timeStamp'> &
  Partial<Omit<QuestionRecord, keyof CardRecord>> & { timeStamp: string };

/** A `CardHistory` whose records carry ISO timestamps. */
export type DatasetCardHistory = Omit<CardHistory<CardRecord>, 'records'> & {
  records: DatasetRecord[];
};

/** What a view or detector needs to know about a card, joined from the course slice. */
export interface CardSummary {
  cardId: string;
  /** The question type's name, from `id_view` ("Course.question.Spelling.SpellingView" → "Spelling"). */
  questionType?: string;
  elo?: CardData['elo'];
  /** Applied tags, from the course's TAG docs. */
  tags: string[];
  /** The card's displayable-data fields by name (the word, the answer, etc). */
  data: Record<string, unknown>;
}

/** One learner in one course, indexed for reading. Built from a {@link LearnerDump} by {@link fromDump}. */
export interface LearnerDataset {
  username: string;
  courseId: string;
  /** When the records were read. Derivations take "now" from here, never the wall clock. */
  asOf: string;
  /** Oldest first. */
  sessions: StudySessionDoc[];
  /** Records oldest first, timestamps normalized to ISO. */
  cardHistories: DatasetCardHistory[];
  /** Pending reviews, soonest first. */
  scheduled: ScheduledCard[];
  registration?: CourseRegistrationDoc;
  /** `STRATEGY_STATE` docs' `data`, by strategy key. */
  strategyState: Record<string, unknown>;
  tombstones: Array<{ id: string; seq: number }>;
  /** Absent when the dump carried no course slice. */
  cards?: Map<string, CardSummary>;
  /** The course's strategy docs at dump time. Absent when the dump didn't carry them. */
  strategies?: ContentNavigationStrategyData[];
}

/**
 * Normalize a stored timestamp to ISO. Card-history `timeStamp`s persist as
 * `Moment.toString()` ("Sat Jul 18 2026 23:26:16 GMT+0000"), which sorts by
 * weekday name, not time. Returns the input unchanged if it doesn't parse.
 */
export function toIsoTimestamp(value: unknown): string {
  if (typeof value === 'number') return new Date(value).toISOString();
  const s = String(value ?? '');
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? s : new Date(ms).toISOString();
}

/** `userdb-<username>-2026-09-30T1412Z.json`: sortable and filename-safe. */
export function dumpFileName(dump: Pick<LearnerDump, 'username' | 'fetchedAt'>): string {
  return `userdb-${dump.username}-${dump.fetchedAt.slice(0, 16).replace(':', '')}Z.json`;
}

/** Parse and minimally validate a dump file's text. */
export function parseLearnerDump(text: string): LearnerDump {
  const dump = JSON.parse(text) as Partial<LearnerDump>;
  if (!dump || typeof dump.username !== 'string' || !Array.isArray(dump.docs)) {
    throw new Error('[diagnostics] Not a learner dump: expected `username` and a `docs` array');
  }
  return dump as LearnerDump;
}

function questionTypeOf(idView: unknown): string | undefined {
  if (typeof idView !== 'string') return undefined;
  const parts = idView.split('.');
  return parts.length >= 2 ? parts[parts.length - 2] : idView;
}

function summarizeCards(slice: CourseSlice): Map<string, CardSummary> {
  const data = new Map(slice.displayableData.map((dd) => [dd._id, dd]));
  const cards = new Map<string, CardSummary>();
  for (const card of slice.cards) {
    const fields: Record<string, unknown> = {};
    for (const f of data.get(card.id_displayable_data?.[0] ?? '')?.data ?? []) {
      fields[f.name] = f.data;
    }
    cards.set(card._id, {
      cardId: card._id,
      questionType: questionTypeOf(card.id_view),
      elo: card.elo,
      tags: [],
      data: fields,
    });
  }
  for (const tag of slice.tags) {
    for (const cardId of tag.taggedCards ?? []) cards.get(cardId)?.tags.push(tag.name);
  }
  return cards;
}

/** The dump's course, else the course most of its sessions belong to. */
function inferCourseId(dump: LearnerDump): string | undefined {
  if (dump.courseId) return dump.courseId;
  if (dump.course) return dump.course.courseId;
  const counts = new Map<string, number>();
  for (const d of dump.docs) {
    if (d._id.startsWith(PREFIX.session) && typeof d.courseId === 'string') {
      counts.set(d.courseId, (counts.get(d.courseId) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/**
 * Index a dump for one course. Records for other courses in the same user DB
 * (retired or sibling courses) are left out.
 */
export function fromDump(dump: LearnerDump, courseId?: string): LearnerDataset {
  const course = courseId ?? inferCourseId(dump);
  if (!course) throw new Error('[diagnostics] No course id given, and none found in the dump');

  const sessions: StudySessionDoc[] = [];
  const cardHistories: DatasetCardHistory[] = [];
  const scheduled: ScheduledCard[] = [];
  const strategyState: Record<string, unknown> = {};
  let registration: CourseRegistrationDoc | undefined;

  for (const doc of dump.docs) {
    const id = doc._id;
    if (id.startsWith(PREFIX.session)) {
      if (doc.courseId === course) sessions.push(doc as unknown as StudySessionDoc);
    } else if (id.startsWith(PREFIX.cardHistory)) {
      if (doc.courseID !== course) continue;
      const history = doc as unknown as DatasetCardHistory;
      cardHistories.push({
        ...history,
        records: (history.records ?? [])
          .map((r) => ({ ...r, timeStamp: toIsoTimestamp(r.timeStamp) }))
          .sort((a, b) => a.timeStamp.localeCompare(b.timeStamp)),
      });
    } else if (id.startsWith(PREFIX.scheduled)) {
      if (doc.courseId === course) scheduled.push(doc as unknown as ScheduledCard);
    } else if (id.startsWith(PREFIX.strategyState)) {
      const [, docCourse, key] = id.split('::');
      if (docCourse === course && key) strategyState[key] = doc.data;
    } else if (id === PREFIX.registrations) {
      registration = doc as unknown as CourseRegistrationDoc;
    }
  }

  sessions.sort((a, b) => a.startTime.localeCompare(b.startTime));
  scheduled.sort((a, b) => String(a.reviewTime).localeCompare(String(b.reviewTime)));

  return {
    username: dump.username,
    courseId: course,
    asOf: dump.fetchedAt,
    sessions,
    cardHistories,
    scheduled,
    registration,
    strategyState,
    tombstones: (dump.tombstones ?? []).map(({ id, seq }) => ({ id, seq })),
    ...(dump.course && dump.course.courseId === course
      ? {
          cards: summarizeCards(dump.course),
          ...(dump.course.strategies ? { strategies: dump.course.strategies } : {}),
        }
      : {}),
  };
}
