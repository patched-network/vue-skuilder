import { CourseDBInterface, CourseInfo, CoursesDBInterface, UserDBInterface } from '@/core';
import { ScheduledCard } from '@/core/types/user';
import {
  CourseConfig,
  CourseElo,
  DataShape,
  EloToNumber,
  Status,
  blankCourseElo,
  toCourseElo,
} from '@vue-skuilder/common';
import _ from 'lodash';
import { filterAllDocsByPrefix, getCourseDB, getCourseDoc, getCourseDocs } from '.';
import {
  StudyContentSource,
  StudySessionItem,
  StudySessionNewItem,
  StudySessionReviewItem,
} from '../../core/interfaces/contentSource';
import { CardData, DocType, SkuilderCourseData, Tag, TagStub } from '../../core/types/types-legacy';
import { GET_CACHED } from './clientCache';
import { addNote55, addTagToCard, getCredentialledCourseConfig, getTagID } from './courseAPI';
import { DataLayerResult } from '@/core/types/db';
import { PouchError } from './types';
import CourseLookup from './courseLookupDB';
import { ContentNavigationStrategyData } from '@/core/types/contentNavigationStrategy';
import { ContentNavigator, Navigators } from '@/core/navigators';

export class CoursesDB implements CoursesDBInterface {
  _courseIDs: string[] | undefined;

  constructor(courseIDs?: string[]) {
    if (courseIDs && courseIDs.length > 0) {
      this._courseIDs = courseIDs;
    } else {
      this._courseIDs = undefined;
    }
  }

  public async getCourseList(): Promise<CourseConfig[]> {
    let crsList = await CourseLookup.allCourses();
    console.log(`AllCourses: ${crsList.map((c) => c.name + ', ' + c._id + '\n\t')}`);
    if (this._courseIDs) {
      crsList = crsList.filter((c) => this._courseIDs!.includes(c._id));
    }

    console.log(`AllCourses.filtered: ${crsList.map((c) => c.name + ', ' + c._id + '\n\t')}`);

    const cfgs = await Promise.all(
      crsList.map(async (c) => {
        try {
          const cfg = await getCredentialledCourseConfig(c._id);
          console.log(`Found cfg: ${JSON.stringify(cfg)}`);
          return cfg;
        } catch (e) {
          console.warn(`Error fetching cfg for course ${c.name}, ${c._id}: ${e}`);
          return undefined;
        }
      })
    );
    return cfgs.filter((c) => !!c);
  }

  async getCourseConfig(courseId: string): Promise<CourseConfig> {
    if (this._courseIDs && this._courseIDs.length && !this._courseIDs.includes(courseId)) {
      throw new Error(`Course ${courseId} not in course list`);
    }

    const cfg = await getCredentialledCourseConfig(courseId);
    if (cfg === undefined) {
      throw new Error(`Error fetching cfg for course ${courseId}`);
    } else {
      return cfg;
    }
  }

  public async disambiguateCourse(courseId: string, disambiguator: string): Promise<void> {
    await CourseLookup.updateDisambiguator(courseId, disambiguator);
  }
}

function randIntWeightedTowardZero(n: number) {
  return Math.floor(Math.random() * Math.random() * Math.random() * n);
}

export class CourseDB implements StudyContentSource, CourseDBInterface {
  // private log(msg: string): void {
  //   log(`CourseLog: ${this.id}\n  ${msg}`);
  // }

  private db: PouchDB.Database;
  private id: string;
  private _getCurrentUser: () => Promise<UserDBInterface>;

  constructor(id: string, userLookup: () => Promise<UserDBInterface>) {
    this.id = id;
    this.db = getCourseDB(this.id);
    this._getCurrentUser = userLookup;
  }

  public getCourseID(): string {
    return this.id;
  }

  public async getCourseInfo(): Promise<CourseInfo> {
    const cardCount = (
      await this.db.find({
        selector: {
          docType: DocType.CARD,
        },
        limit: 1000,
      })
    ).docs.length;

    return {
      cardCount,
      registeredUsers: 0,
    };
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

  async getCardsByELO(elo: number, cardLimit?: number) {
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

  async getCourseConfig(): Promise<CourseConfig> {
    const ret = await getCredentialledCourseConfig(this.id);
    if (ret) {
      return ret;
    } else {
      throw new Error(`Course config not found for course ID: ${this.id}`);
    }
  }

  async updateCourseConfig(cfg: CourseConfig): Promise<PouchDB.Core.Response> {
    console.log(`Updating: ${JSON.stringify(cfg)}`);
    // write both to the course DB:
    try {
      return await updateCredentialledCourseConfig(this.id, cfg);
    } catch (error) {
      console.error(`Error updating course config in course DB: ${error}`);
      throw error;
    }
  }

  async updateCardElo(cardId: string, elo: CourseElo) {
    const ret = await updateCardElo(this.id, cardId, elo);
    if (ret) {
      return ret;
    } else {
      throw new Error(`Failed to update card elo for card ID: ${cardId}`);
    }
  }

  async getAppliedTags(cardId: string): Promise<PouchDB.Query.Response<TagStub>> {
    const ret = getAppliedTags(this.id, cardId);
    if (ret) {
      return ret;
    } else {
      throw new Error(`Failed to find tags for card ${this.id}-${cardId}`);
    }
  }

  async addTagToCard(
    cardId: string,
    tagId: string,
    updateELO?: boolean
  ): Promise<PouchDB.Core.Response> {
    return await addTagToCard(this.id, cardId, tagId, updateELO);
  }

  async removeTagFromCard(cardId: string, tagId: string): Promise<PouchDB.Core.Response> {
    return await removeTagFromCard(this.id, cardId, tagId);
  }

  async createTag(name: string): Promise<PouchDB.Core.Response> {
    return await createTag(this.id, name);
  }

  async getTag(tagId: string): Promise<PouchDB.Core.GetMeta & PouchDB.Core.Document<Tag>> {
    return await getTag(this.id, tagId);
  }

  async updateTag(tag: Tag): Promise<PouchDB.Core.Response> {
    if (tag.course !== this.id) {
      throw new Error(`Tag ${JSON.stringify(tag)} does not belong to course ${this.id}`);
    }

    return await updateTag(tag);
  }

  async getCourseTagStubs(): Promise<PouchDB.Core.AllDocsResponse<Tag>> {
    return getCourseTagStubs(this.id);
  }

  async addNote(
    codeCourse: string,
    shape: DataShape,
    data: unknown,
    author: string,
    tags: string[],
    uploads?: { [key: string]: PouchDB.Core.FullAttachment },
    elo: CourseElo = blankCourseElo()
  ): Promise<DataLayerResult> {
    try {
      const resp = await addNote55(this.id, codeCourse, shape, data, author, tags, uploads, elo);
      if (resp.ok) {
        // Check if card creation failed (property added by addNote55)
        if ((resp as any).cardCreationFailed) {
          console.warn(
            `[courseDB.addNote] Note added but card creation failed: ${
              (resp as any).cardCreationError
            }`
          );
          return {
            status: Status.error,
            message: `Note was added but no cards were created: ${(resp as any).cardCreationError}`,
            id: resp.id,
          };
        }
        return {
          status: Status.ok,
          message: '',
          id: resp.id,
        };
      } else {
        return {
          status: Status.error,
          message: 'Unexpected error adding note',
        };
      }
    } catch (e) {
      const err = e as PouchDB.Core.Error;
      console.error(
        `[addNote] error ${err.name}\n\treason: ${err.reason}\n\tmessage: ${err.message}`
      );
      return {
        status: Status.error,
        message: `Error adding note to course. ${(e as PouchError).reason || err.message}`,
      };
    }
  }

  async getCourseDoc<T extends SkuilderCourseData>(
    id: string,
    options?: PouchDB.Core.GetOptions
  ): Promise<PouchDB.Core.GetMeta & PouchDB.Core.Document<T>> {
    return await getCourseDoc(this.id, id, options);
  }

  async getCourseDocs<T extends SkuilderCourseData>(
    ids: string[],
    options: PouchDB.Core.AllDocsOptions = {}
  ): Promise<PouchDB.Core.AllDocsWithKeysResponse<{} & T>> {
    return await getCourseDocs(this.id, ids, options);
  }

  ////////////////////////////////////
  // NavigationStrategyManager implementation
  ////////////////////////////////////

  getNavigationStrategy(id: string): Promise<ContentNavigationStrategyData> {
    console.log(`[courseDB] Getting navigation strategy: ${id}`);
    // For now, just return the ELO strategy regardless of the ID
    const strategy: ContentNavigationStrategyData = {
      id: 'ELO',
      docType: DocType.NAVIGATION_STRATEGY,
      name: 'ELO',
      description: 'ELO-based navigation strategy for ordering content by difficulty',
      implementingClass: Navigators.ELO,
      course: this.id,
      serializedData: '', // serde is a noop for ELO navigator.
    };
    return Promise.resolve(strategy);
  }

  getAllNavigationStrategies(): Promise<ContentNavigationStrategyData[]> {
    console.log('[courseDB] Returning hard-coded navigation strategies');
    const strategies: ContentNavigationStrategyData[] = [
      {
        id: 'ELO',
        docType: DocType.NAVIGATION_STRATEGY,
        name: 'ELO',
        description: 'ELO-based navigation strategy for ordering content by difficulty',
        implementingClass: Navigators.ELO,
        course: this.id,
        serializedData: '', // serde is a noop for ELO navigator.
      },
    ];
    return Promise.resolve(strategies);
  }

  addNavigationStrategy(data: ContentNavigationStrategyData): Promise<void> {
    console.log(`[courseDB] Adding navigation strategy: ${data.id}`);
    // For now, just log the data and return success
    console.log(data);
    return Promise.resolve();
  }
  updateNavigationStrategy(id: string, data: ContentNavigationStrategyData): Promise<void> {
    console.log(`[courseDB] Updating navigation strategy: ${id}`);
    // For now, just log the data and return success
    console.log(data);
    return Promise.resolve();
  }

  async surfaceNavigationStrategy(): Promise<ContentNavigationStrategyData> {
    console.warn(`Returning hard-coded default ELO navigator`);
    const ret: ContentNavigationStrategyData = {
      id: 'ELO',
      docType: DocType.NAVIGATION_STRATEGY,
      name: 'ELO',
      description: 'ELO-based navigation strategy',
      implementingClass: Navigators.ELO,
      course: this.id,
      serializedData: '', // serde is a noop for ELO navigator.
    };
    return Promise.resolve(ret);
  }

  ////////////////////////////////////
  // END NavigationStrategyManager implementation
  ////////////////////////////////////

  ////////////////////////////////////
  // StudyContentSource implementation
  ////////////////////////////////////

  public async getNewCards(limit: number = 99): Promise<StudySessionNewItem[]> {
    const u = await this._getCurrentUser();

    try {
      const strategy = await this.surfaceNavigationStrategy();
      const navigator = await ContentNavigator.create(u, this, strategy);
      return navigator.getNewCards(limit);
    } catch (e) {
      console.error(`[courseDB] Error surfacing a NavigationStrategy: ${e}`);
      throw e;
    }
  }

  public async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    const u = await this._getCurrentUser();

    try {
      const strategy = await this.surfaceNavigationStrategy();
      const navigator = await ContentNavigator.create(u, this, strategy);
      return navigator.getPendingReviews();
    } catch (e) {
      console.error(`[courseDB] Error surfacing a NavigationStrategy: ${e}`);
      throw e;
    }
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
}

/**
 * Returns a list of registered datashapes for the specified
 * course.
 * @param courseID The ID of the course
 */
export async function getCourseDataShapes(courseID: string) {
  const cfg = await getCredentialledCourseConfig(courseID);
  return cfg!.dataShapes;
}

export async function getCredentialledDataShapes(courseID: string) {
  const cfg = await getCredentialledCourseConfig(courseID);

  return cfg.dataShapes;
}

export async function getCourseQuestionTypes(courseID: string) {
  const cfg = await getCredentialledCourseConfig(courseID);
  return cfg!.questionTypes;
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
    _rev: (old as any)._rev,
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
