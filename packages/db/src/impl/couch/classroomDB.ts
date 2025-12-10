import { StudyContentSource } from '@db/core/interfaces/contentSource';
import { WeightedCard } from '@db/core/navigators';
import { ClassroomConfig } from '@vue-skuilder/common';
import { ENV } from '@db/factory';
import { logger } from '@db/util/logger';
import moment from 'moment';
import pouch from './pouchdb-setup';
import { getStartAndEndKeys, createPouchDBConfig, REVIEW_TIME_FORMAT } from '.';
import { CourseDB, getTag } from './courseDB';

import { UserDBInterface } from '@db/core';
import {
  AssignedContent,
  AssignedCourse,
  AssignedTag,
  StudentClassroomDBInterface,
  TeacherClassroomDBInterface,
} from '@db/core/interfaces/classroomDB';

const classroomLookupDBTitle = 'classdb-lookup';
export const CLASSROOM_CONFIG = 'ClassroomConfig';

export type ClassroomMessage = object;

abstract class ClassroomDBBase {
  public _id!: string;
  protected _db!: PouchDB.Database;
  protected _cfg!: ClassroomConfig;
  protected _initComplete: boolean = false;

  protected readonly _content_prefix: string = 'content';
  protected get _content_searchkeys() {
    return getStartAndEndKeys(this._content_prefix);
  }

  protected abstract init(): Promise<void>;

  public async getAssignedContent(): Promise<AssignedContent[]> {
    logger.info(`Getting assigned content...`);
    // see couchdb docs 6.2.2:
    //   Guide to Views -> Views Collation -> String Ranges
    const docRows = await this._db.allDocs<AssignedContent>({
      startkey: this._content_prefix,
      endkey: this._content_prefix + `\ufff0`,
      include_docs: true,
    });

    const ret = docRows.rows.map((row) => {
      return row.doc!;
    });
    // logger.info(`Assigned content: ${JSON.stringify(ret)}`);

    return ret;
  }

  protected getContentId(content: AssignedContent): string {
    if (content.type === 'tag') {
      return `${this._content_prefix}-${content.courseID}-${content.tagID}`;
    } else {
      return `${this._content_prefix}-${content.courseID}`;
    }
  }

  public get ready(): boolean {
    return this._initComplete;
  }
  public getConfig(): ClassroomConfig {
    return this._cfg;
  }
}

export class StudentClassroomDB
  extends ClassroomDBBase
  implements StudyContentSource, StudentClassroomDBInterface
{
  // private readonly _prefix: string = 'content';
  private userMessages!: PouchDB.Core.Changes<object>;
  private _user: UserDBInterface;

  private constructor(classID: string, user: UserDBInterface) {
    super();
    this._id = classID;
    this._user = user;
    // init() is called explicitly in factory method, not in constructor
  }

  async init(): Promise<void> {
    const dbName = `classdb-student-${this._id}`;
    this._db = new pouch(
      ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + dbName,
      createPouchDBConfig()
    );
    try {
      const cfg = await this._db.get<ClassroomConfig>(CLASSROOM_CONFIG);
      this._cfg = cfg;
      this.userMessages = this._db.changes({
        since: 'now',
        live: true,
        include_docs: true,
      });
      this._initComplete = true;
      return;
    } catch (e) {
      throw new Error(`Error in StudentClassroomDB constructor: ${JSON.stringify(e)}`);
    }
  }

  public static async factory(classID: string, user: UserDBInterface): Promise<StudentClassroomDB> {
    const ret = new StudentClassroomDB(classID, user);
    await ret.init();
    return ret;
  }

  public setChangeFcn(f: (value: unknown) => object): void {
    // todo: make this into a view request, w/ the user's name attached
    // todo: requires creating the view doc on classroom create in /express
    void this.userMessages.on('change', f);
  }

  /**
   * Get cards with suitability scores for presentation.
   *
   * Gathers new cards from assigned content (courses, tags, cards) and
   * pending reviews scheduled for this classroom. Assigns score=1.0 to all.
   *
   * @param limit - Maximum number of cards to return
   * @returns Cards sorted by score descending (all scores = 1.0)
   */
  public async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    const weighted: WeightedCard[] = [];

    // Get pending reviews for this classroom
    const allUserReviews = await this._user.getPendingReviews();
    const classroomReviews = allUserReviews.filter(
      (r) => r.scheduledFor === 'classroom' && r.schedulingAgentId === this._id
    );

    for (const r of classroomReviews) {
      weighted.push({
        cardId: r.cardId,
        courseId: r.courseId,
        score: 1.0,
        reviewID: r._id,
        provenance: [
          {
            strategy: 'classroom',
            strategyName: 'Classroom',
            strategyId: 'CLASSROOM',
            action: 'generated' as const,
            score: 1.0,
            reason: 'Classroom scheduled review',
          },
        ],
      });
    }

    // Get new cards from assigned content
    const activeCards = await this._user.getActiveCards();
    const activeCardIds = new Set(activeCards.map((ac) => ac.cardID));
    const now = moment.utc();
    const assigned = await this.getAssignedContent();
    const due = assigned.filter((c) => now.isAfter(moment.utc(c.activeOn, REVIEW_TIME_FORMAT)));

    logger.info(`[StudentClassroomDB] Due content: ${JSON.stringify(due)}`);

    for (const content of due) {
      if (content.type === 'course') {
        // Get weighted cards from the course directly
        const db = new CourseDB(content.courseID, async () => this._user);
        const courseCards = await db.getWeightedCards(limit);
        for (const card of courseCards) {
          if (!activeCardIds.has(card.cardId)) {
            weighted.push({
              ...card,
              provenance: [
                ...card.provenance,
                {
                  strategy: 'classroom',
                  strategyName: 'Classroom',
                  strategyId: 'CLASSROOM',
                  action: 'passed' as const,
                  score: card.score,
                  reason: `Assigned via classroom from course ${content.courseID}`,
                },
              ],
            });
          }
        }
      } else if (content.type === 'tag') {
        const tagDoc = await getTag(content.courseID, content.tagID);

        for (const cardId of tagDoc.taggedCards) {
          if (!activeCardIds.has(cardId)) {
            weighted.push({
              cardId,
              courseId: content.courseID,
              score: 1.0,
              provenance: [
                {
                  strategy: 'classroom',
                  strategyName: 'Classroom',
                  strategyId: 'CLASSROOM',
                  action: 'generated' as const,
                  score: 1.0,
                  reason: `Classroom assigned tag: ${content.tagID}, new card`,
                },
              ],
            });
          }
        }
      } else if (content.type === 'card') {
        if (!activeCardIds.has(content.cardID)) {
          weighted.push({
            cardId: content.cardID,
            courseId: content.courseID,
            score: 1.0,
            provenance: [
              {
                strategy: 'classroom',
                strategyName: 'Classroom',
                strategyId: 'CLASSROOM',
                action: 'generated' as const,
                score: 1.0,
                reason: 'Classroom assigned card, new card',
              },
            ],
          });
        }
      }
    }

    logger.info(
      `[StudentClassroomDB] New cards from classroom ${this._cfg.name}: ` +
        `${weighted.length} total (reviews + new)`
    );

    // Sort by score descending and limit
    return weighted.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

/**
 * Interface for managing a classroom.
 */
export class TeacherClassroomDB extends ClassroomDBBase implements TeacherClassroomDBInterface {
  private _stuDb!: PouchDB.Database;

  private constructor(classID: string) {
    super();
    this._id = classID;
  }

  async init(): Promise<void> {
    const dbName = `classdb-teacher-${this._id}`;
    const stuDbName = `classdb-student-${this._id}`;
    this._db = new pouch(
      ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + dbName,
      createPouchDBConfig()
    );
    this._stuDb = new pouch(
      ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + stuDbName,
      createPouchDBConfig()
    );
    try {
      return this._db
        .get<ClassroomConfig>(CLASSROOM_CONFIG)
        .then((cfg) => {
          this._cfg = cfg;
          this._initComplete = true;
        })
        .then(() => {
          return;
        });
    } catch (e) {
      throw new Error(`Error in TeacherClassroomDB constructor: ${JSON.stringify(e)}`);
    }
  }

  public static async factory(classID: string): Promise<TeacherClassroomDB> {
    const ret = new TeacherClassroomDB(classID);
    await ret.init();
    return ret;
  }

  public async removeContent(content: AssignedContent): Promise<void> {
    const contentID = this.getContentId(content);

    try {
      const doc = await this._db.get(contentID);
      await this._db.remove(doc);
      void this._db.replicate.to(this._stuDb, {
        doc_ids: [contentID],
      });
    } catch (error) {
      logger.error('Failed to remove content:', contentID, error);
    }
  }

  public async assignContent(content: AssignedContent): Promise<boolean> {
    let put: PouchDB.Core.Response;
    const id: string = this.getContentId(content);

    if (content.type === 'tag') {
      put = await this._db.put<AssignedTag>({
        courseID: content.courseID,
        tagID: content.tagID,
        type: 'tag',
        _id: id,
        assignedBy: content.assignedBy,
        assignedOn: moment.utc(),
        activeOn: content.activeOn || moment.utc(),
      });
    } else {
      put = await this._db.put<AssignedCourse>({
        courseID: content.courseID,
        type: 'course',
        _id: id,
        assignedBy: content.assignedBy,
        assignedOn: moment.utc(),
        activeOn: content.activeOn || moment.utc(),
      });
    }

    if (put.ok) {
      void this._db.replicate.to(this._stuDb, {
        doc_ids: [id],
      });
      return true;
    } else {
      return false;
    }
  }
}

export const ClassroomLookupDB: () => PouchDB.Database = () =>
  new pouch(ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + classroomLookupDBTitle, {
    skip_setup: true,
  });

export function getClassroomDB(classID: string, version: 'student' | 'teacher'): PouchDB.Database {
  const dbName = `classdb-${version}-${classID}`;
  logger.info(`Retrieving classroom db: ${dbName}`);

  return new pouch(
    ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + dbName,
    createPouchDBConfig()
  );
}

export async function getClassroomConfig(classID: string): Promise<ClassroomConfig> {
  return await getClassroomDB(classID, 'student').get<ClassroomConfig>(CLASSROOM_CONFIG);
}
