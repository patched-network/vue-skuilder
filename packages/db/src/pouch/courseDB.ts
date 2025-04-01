import _ from 'lodash';
import pouch from 'pouchdb-browser';
import { filterAllDocsByPrefix, getCourseDB } from '.';
import { ENV, CourseConfig } from '@vue-skuilder/common';
import { CourseElo, EloToNumber, blankCourseElo, toCourseElo } from '@vue-skuilder/common';
import { GET_CACHED } from './clientCache';
import {
  StudyContentSource,
  StudySessionItem,
  StudySessionNewItem,
  StudySessionReviewItem,
} from '../core/interfaces/contentSource';
import { getCredentialledCourseConfig, getTagID } from './courseAPI';
import { CardData, DocType, Tag, TagStub } from '../core/types-legacy';
import { User } from './userDB';
import { ScheduledCard } from '@/core/types/user';

const courseLookupDBTitle = 'coursedb-lookup';

interface PouchDBError extends Error {
  error?: string;
  reason?: string;
}

export function docIsDeleted(e: PouchDBError): boolean {
  return Boolean(e?.error === 'not_found' && e?.reason === 'deleted');
}

const courseLookupDB: PouchDB.Database = new pouch(
  ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + courseLookupDBTitle,
  {
    skip_setup: true,
  }
);

function randIntWeightedTowardZero(n: number) {
  return Math.floor(Math.random() * Math.random() * Math.random() * n);
}

export class CourseDB implements StudyContentSource {
  // private log(msg: string): void {
  //   log(`CourseLog: ${this.id}\n  ${msg}`);
  // }

  private db: PouchDB.Database;
  private id: string;
  private _getCurrentUser: () => Promise<User>;

  constructor(id: string, userLookup: () => Promise<User>) {
    this.id = id;
    this.db = getCourseDB(this.id);
    this._getCurrentUser = userLookup;
  }

  public async getStudySession(cardLimit: number = 99) {
    // cardLimit = cardLimit ? cardLimit : 999;
    const u = await this._getCurrentUser();
    const userCrsdoc = await u.getCourseRegDoc(this.id);
    const activeCards = await u.getActiveCards();

    // console.log()
    const newCards = (await this.getCardsByELO(EloToNumber(userCrsdoc!.elo), cardLimit)).filter(
      (card) => {
        return activeCards.indexOf(card) === -1;
      }
    );

    // get scheduled reviews ... .... .....
    return newCards;
  }
  public async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    type ratedReview = ScheduledCard & CourseElo;

    const u = await this._getCurrentUser();
    u.getCourseRegDoc(this.id);

    const reviews = await u.getPendingReviews(this.id); // todo: this adds a db round trip - should be server side
    const elo = await this.getCardEloData(reviews.map((r) => r.cardId));

    const ratedReviews = reviews.map((r, i) => {
      const ratedR: ratedReview = {
        ...r,
        ...elo[i],
      };
      return ratedR;
    });

    ratedReviews.sort((a, b) => {
      return a.global.score - b.global.score;
    });

    return ratedReviews.map((r) => {
      return {
        ...r,
        contentSourceType: 'course',
        contentSourceID: this.id,
        cardID: r.cardId,
        courseID: r.courseId,
        qualifiedID: `${r.courseId}-${r.cardId}`,
        reviewID: r._id,
        status: 'review',
      };
    });
  }

  public async getInexperiencedCards(limit: number = 2) {
    return (
      await this.db.query('cardsByInexperience', {
        limit,
      })
    ).rows.map((r) => {
      const ret = {
        courseId: this.id,
        cardId: r.id,
        count: r.key,
        elo: r.value,
      };
      return ret;
    });
  }

  public async getCardsByEloLimits(
    options: {
      low: number;
      high: number;
      limit: number;
      page: number;
    } = {
      low: 0,
      high: Number.MIN_SAFE_INTEGER,
      limit: 25,
      page: 0,
    }
  ) {
    return (
      await this.db.query('elo', {
        startkey: options.low,
        endkey: options.high,
        limit: options.limit,
        skip: options.limit * options.page,
      })
    ).rows.map((r) => {
      return `${this.id}-${r.id}-${r.key}`;
    });
  }
  public async getCardEloData(id: string[]): Promise<CourseElo[]> {
    const docs = await this.db.allDocs<CardData>({
      keys: id,
      include_docs: true,
    });
    const ret: CourseElo[] = [];
    docs.rows.forEach((r) => {
      // [ ] remove these ts-ignore directives.
      if (isSuccessRow(r)) {
        if (r.doc && r.doc.elo) {
          ret.push(toCourseElo(r.doc.elo));
        } else {
          console.warn('no elo data for card: ' + r.id);
          ret.push(blankCourseElo());
        }
      } else {
        console.warn('no elo data for card: ' + JSON.stringify(r));
        ret.push(blankCourseElo());
      }
    });
    return ret;
  }

  /**
   * Returns the lowest and highest `global` ELO ratings in the course
   */
  public async getELOBounds() {
    const [low, high] = await Promise.all([
      (
        await this.db.query('elo', {
          startkey: 0,
          limit: 1,
          include_docs: false,
        })
      ).rows[0].key,
      (
        await this.db.query('elo', {
          limit: 1,
          descending: true,
          startkey: 100_000,
        })
      ).rows[0].key,
    ]);

    return {
      low: low,
      high: high,
    };
  }

  public async removeCard(id: string) {
    const doc = await this.db.get<CardData>(id);
    if (!doc.docType || !(doc.docType === DocType.CARD)) {
      throw new Error(`failed to remove ${id} from course ${this.id}. id does not point to a card`);
    }
    // TODO: remove card from tags lists (getTagsByCards)
    return this.db.remove(doc);
  }

  public async getCardDisplayableDataIDs(id: string[]) {
    console.log(id);
    const cards = await this.db.allDocs<CardData>({
      keys: id,
      include_docs: true,
    });
    const ret: { [card: string]: string[] } = {};
    cards.rows.forEach((r) => {
      if (isSuccessRow(r)) {
        ret[r.id] = r.doc!.id_displayable_data;
      }
    });

    await Promise.all(
      cards.rows.map((r) => {
        return async () => {
          if (isSuccessRow(r)) {
            ret[r.id] = r.doc!.id_displayable_data;
          }
        };
      })
    );

    return ret;
  }

  public async getCardsCenteredAtELO(
    options: {
      limit: number;
      elo: 'user' | 'random' | number;
    } = {
      limit: 99,
      elo: 'user',
    },
    filter?: (a: string) => boolean
  ): Promise<StudySessionItem[]> {
    let targetElo: number;

    if (options.elo === 'user') {
      const u = await this._getCurrentUser();

      targetElo = -1;
      try {
        const courseDoc = (await u.getCourseRegistrationsDoc()).courses.find((c) => {
          return c.courseID === this.id;
        })!;
        targetElo = EloToNumber(courseDoc.elo);
      } catch {
        targetElo = 1000;
      }
    } else if (options.elo === 'random') {
      const bounds = await GET_CACHED(`elo-bounds-${this.id}`, () => this.getELOBounds());
      targetElo = Math.round(bounds.low + Math.random() * (bounds.high - bounds.low));
      // console.log(`Picked ${targetElo} from [${bounds.low}, ${bounds.high}]`);
    } else {
      targetElo = options.elo;
    }

    let cards: string[] = [];
    let mult: number = 4;
    let previousCount: number = -1;
    let newCount: number = 0;

    while (cards.length < options.limit && newCount !== previousCount) {
      cards = await this.getCardsByELO(targetElo, mult * options.limit);
      previousCount = newCount;
      newCount = cards.length;

      console.log(`Found ${cards.length} elo neighbor cards...`);

      if (filter) {
        cards = cards.filter(filter);
        console.log(`Filtered to ${cards.length} cards...`);
      }

      mult *= 2;
    }

    const selectedCards: string[] = [];

    while (selectedCards.length < options.limit && cards.length > 0) {
      const index = randIntWeightedTowardZero(cards.length);
      const card = cards.splice(index, 1)[0];
      selectedCards.push(card);
    }

    return selectedCards.map((c) => {
      const split = c.split('-');
      return {
        courseID: this.id,
        cardID: split[1],
        qualifiedID: `${split[0]}-${split[1]}`,
        contentSourceType: 'course',
        contentSourceID: this.id,
        status: 'new',
      };
    });
  }
  public async getNewCards(limit: number = 99): Promise<StudySessionNewItem[]> {
    const u = await this._getCurrentUser();

    const activeCards = await u.getActiveCards();
    return (
      await this.getCardsCenteredAtELO({ limit: limit, elo: 'user' }, (c: string) => {
        if (activeCards.some((ac) => c.includes(ac))) {
          return false;
        } else {
          return true;
        }
      })
    ).map((c) => {
      return {
        ...c,
        status: 'new',
      };
    });
  }

  private async getCardsByELO(elo: number, cardLimit?: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    elo = parseInt(elo as any);
    const limit = cardLimit ? cardLimit : 25;

    const below: PouchDB.Query.Response<object> = await this.db.query('elo', {
      limit: Math.ceil(limit / 2),
      startkey: elo,
      descending: true,
    });

    const aboveLimit = limit - below.rows.length;

    const above: PouchDB.Query.Response<object> = await this.db.query('elo', {
      limit: aboveLimit,
      startkey: elo + 1,
    });
    // console.log(JSON.stringify(below));

    let cards = below.rows;
    cards = cards.concat(above.rows);

    const ret = cards
      .sort((a, b) => {
        const s = Math.abs(a.key - elo) - Math.abs(b.key - elo);
        if (s === 0) {
          return Math.random() - 0.5;
        } else {
          return s;
        }
      })
      .map((c) => `${this.id}-${c.id}-${c.key}`);

    const str = `below:\n${below.rows.map((r) => `\t${r.id}-${r.key}\n`)}

above:\n${above.rows.map((r) => `\t${r.id}-${r.key}\n`)}`;

    console.log(`Getting ${limit} cards centered around elo: ${elo}:\n\n` + str);

    return ret;
  }
}

// export async function incrementCourseMembership(courseID: string) {
//   courseDB.get<CourseConfig>(courseID).then( (course) => {
//     course.
//   })
// }

export async function getCourseName(courseID: string): Promise<string> {
  const ret = (await courseLookupDB.get<CourseConfig>(courseID))['name'];
  // console.log(ret);
  return ret;
}

export async function removeCourse(courseID: string) {
  return courseLookupDB.get(courseID).then((course) => {
    return courseLookupDB.remove({
      ...course,
    });
  });
}

export async function disambiguateCourse(course: string, disambiguator: string) {
  // do NOT update the `CourseConfig` doc in the course database.
  // This information is for the course router only, and does not
  // directly impaact the running of the course itself

  // write to the lookup db
  courseLookupDB.get<CourseConfig>(course).then((cfg) => {
    courseLookupDB.put({
      ...cfg,
      disambiguator,
    });
  });
}

let courseListCache: CourseConfig[] = [];
export async function getCachedCourseList(): Promise<CourseConfig[]> {
  if (courseListCache.length) {
    return courseListCache;
  } else {
    courseListCache = (await getCourseList()).rows.map((r) => {
      return {
        ...r.doc!,
        courseID: r.id,
      };
    });
    return getCachedCourseList();
  }
}

export async function getCourseList() {
  return courseLookupDB.allDocs<CourseConfig>({
    include_docs: true,
  });
}

/**
 * Returns a list of registered datashapes for the specified
 * course.
 * @param courseID The ID of the course
 */
export async function getCourseDataShapes(courseID: string) {
  const cfg = await getCourseConfig(courseID);
  return cfg!.dataShapes;
}

export async function getCredentialledDataShapes(courseID: string) {
  const cfg = await getCredentialledCourseConfig(courseID);

  return cfg.dataShapes;
}

export async function getCourseQuestionTypes(courseID: string) {
  const cfg = await getCourseConfig(courseID);
  return cfg!.questionTypes;
}

export async function getCourseConfig(courseID: string) {
  const config = await getCourseConfigs([courseID]);
  let first = config.rows[0];
  if (!first) {
    throw new Error(`Course config not found for course ID: ${courseID}`);
  } else if (isSuccessRow(first)) {
    return first.doc;
  } else {
    throw new Error(`Course config not found for course ID: ${courseID}`);
  }
}

// todo: this is actually returning full tag docs now.
//       - performance issue when tags have lots of
//         applied docs
//       - will require a computed couch DB view
export async function getCourseTagStubs(
  courseID: string
): Promise<PouchDB.Core.AllDocsResponse<Tag>> {
  console.log(`Getting tag stubs for course: ${courseID}`);
  const stubs = await filterAllDocsByPrefix<Tag>(
    getCourseDB(courseID),
    DocType.TAG.valueOf() + '-'
  );

  stubs.rows.forEach((row) => {
    console.log(`\tTag stub for doc: ${row.id}`);
  });

  return stubs;
}

export async function deleteTag(courseID: string, tagName: string) {
  tagName = getTagID(tagName);
  const courseDB = getCourseDB(courseID);
  const doc = await courseDB.get<Tag>(DocType.TAG.valueOf() + '-' + tagName);
  const resp = await courseDB.remove(doc);
  return resp;
}

export async function createTag(courseID: string, tagName: string) {
  console.log(`Creating tag: ${tagName}...`);
  const tagID = getTagID(tagName);
  const courseDB = getCourseDB(courseID);
  const resp = await courseDB.put<Tag>({
    course: courseID,
    docType: DocType.TAG,
    name: tagName,
    snippet: '',
    taggedCards: [],
    wiki: '',
    _id: tagID,
  });
  return resp;
}

export async function updateTag(tag: Tag) {
  const prior = await getTag(tag.course, tag.name);
  return await getCourseDB(tag.course).put<Tag>({
    ...tag,
    _rev: prior._rev,
  });
}

export async function getTag(courseID: string, tagName: string) {
  const tagID = getTagID(tagName);
  const courseDB = getCourseDB(courseID);
  return courseDB.get<Tag>(tagID);
}

export async function removeTagFromCard(courseID: string, cardID: string, tagID: string) {
  // todo: possible future perf. hit if tags have large #s of taggedCards.
  // In this case, should be converted to a server-request
  tagID = getTagID(tagID);
  const courseDB = getCourseDB(courseID);
  const tag = await courseDB.get<Tag>(tagID);
  _.remove(tag.taggedCards, (taggedID) => {
    return cardID === taggedID;
  });
  return courseDB.put<Tag>(tag);
}

/**
 * Returns an array of ancestor tag IDs, where:
 * return[0] = parent,
 * return[1] = grandparent,
 * return[2] = great grandparent,
 * etc.
 *
 * If ret is empty, the tag itself is a root
 */
export function getAncestorTagIDs(courseID: string, tagID: string): string[] {
  tagID = getTagID(tagID);
  const split = tagID.split('>');
  if (split.length === 1) {
    return [];
  } else {
    split.pop();
    const parent = split.join('>');
    return [parent].concat(getAncestorTagIDs(courseID, parent));
  }
}

export async function getChildTagStubs(courseID: string, tagID: string) {
  return await filterAllDocsByPrefix(getCourseDB(courseID), tagID + '>');
}

export async function getAppliedTags(id_course: string, id_card: string) {
  const db = getCourseDB(id_course);

  const result = await db.query<TagStub>('getTags', {
    startkey: id_card,
    endkey: id_card,
    // include_docs: true
  });

  // log(`getAppliedTags looked up: ${id_card}`);
  // log(`getAppliedTags returning: ${JSON.stringify(result)}`);

  return result;
}

export async function updateCardElo(courseID: string, cardID: string, elo: CourseElo) {
  if (elo) {
    // checking against null, undefined, NaN
    const cDB = getCourseDB(courseID);
    const card = await cDB.get<CardData>(cardID);
    console.log(`Replacing ${JSON.stringify(card.elo)} with ${JSON.stringify(elo)}`);
    card.elo = elo;
    return cDB.put(card); // race conditions - is it important? probably not (net-zero effect)
  }
}

export async function updateCredentialledCourseConfig(courseID: string, config: CourseConfig) {
  console.log(`Updating course config:

${JSON.stringify(config)}
`);

  const db = getCourseDB(courseID);
  const old = await getCredentialledCourseConfig(courseID);

  return await db.put<CourseConfig>({
    ...config,
    _rev: old._rev,
  });
}

export async function getCourseConfigs(ids: string[]) {
  return courseLookupDB.allDocs<CourseConfig>({
    include_docs: true,
    keys: ids,
  });
}

function isSuccessRow<T>(
  row:
    | {
        key: PouchDB.Core.DocumentKey;
        error: 'not_found';
      }
    | {
        doc?: PouchDB.Core.ExistingDocument<PouchDB.Core.AllDocsMeta & T> | null | undefined;
        id: PouchDB.Core.DocumentId;
        key: PouchDB.Core.DocumentKey;
        value: {
          rev: PouchDB.Core.RevisionId;
          deleted?: boolean | undefined;
        };
      }
): row is {
  doc?: PouchDB.Core.ExistingDocument<PouchDB.Core.AllDocsMeta & T> | null | undefined;
  id: PouchDB.Core.DocumentId;
  key: PouchDB.Core.DocumentKey;
  value: {
    rev: PouchDB.Core.RevisionId;
    deleted?: boolean | undefined;
  };
} {
  return 'doc' in row && row.doc !== null && row.doc !== undefined;
}
