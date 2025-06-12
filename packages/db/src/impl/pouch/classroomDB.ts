import {
  StudyContentSource,
  StudySessionNewItem,
  StudySessionReviewItem,
} from '@db/core/interfaces/contentSource';
import { ClassroomConfig } from '@vue-skuilder/common';
import { ENV } from '@db/factory';
import { logger } from '@db/util/logger';
import moment from 'moment';
import pouch from './pouchdb-setup';
import {
  getCourseDB,
  getStartAndEndKeys,
  pouchDBincludeCredentialsConfig,
  REVIEW_TIME_FORMAT,
} from '.';
import { CourseDB, getTag } from './courseDB';

import { UserDBInterface } from '@db/core';
import {
  AssignedContent,
  AssignedCourse,
  AssignedTag,
  StudentClassroomDBInterface,
  TeacherClassroomDBInterface,
} from '@db/core/interfaces/classroomDB';
import { ScheduledCard } from '@db/core/types/user';

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
      pouchDBincludeCredentialsConfig
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

  public async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    const u = this._user;
    return (await u.getPendingReviews())
      .filter((r) => r.scheduledFor === 'classroom' && r.schedulingAgentId === this._id)
      .map((r) => {
        return {
          ...r,
          qualifiedID: `${r.courseId}-${r.cardId}`,
          courseID: r.courseId,
          cardID: r.cardId,
          contentSourceType: 'classroom',
          contentSourceID: this._id,
          reviewID: r._id,
          status: 'review',
        };
      });
  }

  public async getNewCards(): Promise<StudySessionNewItem[]> {
    const activeCards = await this._user.getActiveCards();
    const now = moment.utc();
    const assigned = await this.getAssignedContent();
    const due = assigned.filter((c) => now.isAfter(moment.utc(c.activeOn, REVIEW_TIME_FORMAT)));

    logger.info(`Due content: ${JSON.stringify(due)}`);

    let ret: StudySessionNewItem[] = [];

    for (let i = 0; i < due.length; i++) {
      const content = due[i];

      if (content.type === 'course') {
        const db = new CourseDB(content.courseID, async () => this._user);
        ret = ret.concat(await db.getNewCards());
      } else if (content.type === 'tag') {
        const tagDoc = await getTag(content.courseID, content.tagID);

        ret = ret.concat(
          tagDoc.taggedCards.map((c) => {
            return {
              courseID: content.courseID,
              cardID: c,
              qualifiedID: `${content.courseID}-${c}`,
              contentSourceType: 'classroom',
              contentSourceID: this._id,
              status: 'new',
            };
          })
        );
      } else if (content.type === 'card') {
        // returning card docs - not IDs
        ret.push(await getCourseDB(content.courseID).get(content.cardID));
      }
    }

    logger.info(`New Cards from classroom ${this._cfg.name}: ${ret.map((c) => c.qualifiedID)}`);

    return ret.filter((c) => {
      if (activeCards.some((ac) => c.qualifiedID.includes(ac))) {
        return false;
      } else {
        return true;
      }
    });
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
      pouchDBincludeCredentialsConfig
    );
    this._stuDb = new pouch(
      ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + stuDbName,
      pouchDBincludeCredentialsConfig
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
    pouchDBincludeCredentialsConfig
  );
}

export async function getClassroomConfig(classID: string): Promise<ClassroomConfig> {
  return await getClassroomDB(classID, 'student').get<ClassroomConfig>(CLASSROOM_CONFIG);
}
