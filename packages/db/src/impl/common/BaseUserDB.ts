import { DocType, DocTypePrefixes } from '@db/core';
import { getCardHistoryID } from '@db/core/util';
import { CourseElo, Status } from '@vue-skuilder/common';
import moment, { Moment } from 'moment';
import { GuestUsername } from '../../core/types/types-legacy';
import { logger } from '../../util/logger';

import {
  ClassroomRegistrationDoc,
  UserCourseSetting,
  UserDBInterface,
  UsrCrsDataInterface,
} from '@db/core';
import {
  ActivityRecord,
  CourseRegistration,
  CourseRegistrationDoc,
  ScheduledCard,
  UserConfig,
} from '@db/core/types/user';
import { DocumentUpdater } from '@db/study';
import { CardHistory, CardRecord } from '../../core/types/types-legacy';
import type { SyncStrategy } from './SyncStrategy';
import {
  filterAllDocsByPrefix,
  getStartAndEndKeys,
  REVIEW_TIME_FORMAT,
  getLocalUserDB,
  scheduleCardReviewLocal,
  removeScheduledCardReviewLocal,
} from './userDBHelpers';
import { PouchError } from '../couch/types';
import UpdateQueue, { Update } from '../couch/updateQueue';
import { UsrCrsData } from '../couch/user-course-relDB';
import { getCredentialledCourseConfig } from '../couch/index';

const log = (s: any) => {
  logger.info(s);
};

// console.log(`Connecting to remote: ${remoteStr}`);

interface DesignDoc {
  _id: string;
  views: {
    [viewName: string]: {
      map: string; // String representation of the map function
    };
  };
}

/**
 * Base user database implementation that uses a pluggable sync strategy.
 * Handles local storage operations and delegates sync/remote operations to the strategy.
 */
export class BaseUser implements UserDBInterface, DocumentUpdater {
  private static _instance: BaseUser;
  private static _initialized: boolean = false;

  public static Dummy(syncStrategy: SyncStrategy): BaseUser {
    return new BaseUser('Me', syncStrategy);
  }

  static readonly DOC_IDS = {
    CONFIG: 'CONFIG',
    COURSE_REGISTRATIONS: 'CourseRegistrations',
    CLASSROOM_REGISTRATIONS: 'ClassroomRegistrations',
  };

  // private email: string;
  private _username: string;
  private syncStrategy: SyncStrategy;

  public getUsername(): string {
    return this._username;
  }

  public isLoggedIn(): boolean {
    return !this._username.startsWith(GuestUsername);
  }

  public remote(): PouchDB.Database {
    return this.remoteDB;
  }

  private localDB!: PouchDB.Database;
  private remoteDB!: PouchDB.Database;
  private writeDB!: PouchDB.Database; // Database to use for write operations (local-first approach)

  private updateQueue!: UpdateQueue;

  public async createAccount(
    username: string,
    password: string
  ): Promise<{
    status: Status;
    error: string;
  }> {
    if (!this.syncStrategy.canCreateAccount()) {
      throw new Error('Account creation not supported by current sync strategy');
    }

    if (!this._username.startsWith(GuestUsername)) {
      throw new Error(
        `Cannot create a new account while logged in:
Currently logged-in as ${this._username}.`
      );
    }

    const result = await this.syncStrategy.createAccount!(username, password);

    // If account creation was successful, update the username and reinitialize
    if (result.status === Status.ok) {
      log(`Account created successfully, updating username to ${username}`);
      this._username = username;
      try {
        localStorage.removeItem('dbUUID');
      } catch (e) {
        logger.warn('localStorage not available (Node.js environment):', e);
      }
      await this.init();
    }

    return {
      status: result.status,
      error: result.error || '',
    };
  }
  public async login(username: string, password: string) {
    if (!this.syncStrategy.canAuthenticate()) {
      throw new Error('Authentication not supported by current sync strategy');
    }

    if (!this._username.startsWith(GuestUsername) && this._username != username) {
      if (this._username != username) {
        throw new Error(`Cannot change accounts while logged in.
        Log out of account ${this.getUsername()} before logging in as ${username}.`);
      }
      logger.warn(`User ${this._username} is already logged in, but executing login again.`);
    }

    const loginResult = await this.syncStrategy.authenticate!(username, password);
    if (loginResult.ok) {
      log(`Logged in as ${username}`);
      this._username = username;
      try {
        localStorage.removeItem('dbUUID');
      } catch (e) {
        logger.warn('localStorage not available (Node.js environment):', e);
      }
      await this.init();
    }
    return loginResult;
  }

  public async resetUserData(): Promise<{ status: Status; error?: string }> {
    // Only allow reset for local-only sync strategies
    if (this.syncStrategy.canAuthenticate()) {
      return {
        status: Status.error,
        error:
          'Reset user data is only available for local-only mode. Use logout instead for remote sync.',
      };
    }

    try {
      const localDB = getLocalUserDB(this._username);

      // Get all documents to identify user data to clear
      const allDocs = await localDB.allDocs({ include_docs: false });

      // Identify documents to delete (preserve authentication and user identity)
      const docsToDelete = allDocs.rows
        .filter((row) => {
          const id = row.id;
          // Delete user progress data but preserve core user documents
          return (
            id.startsWith(DocTypePrefixes[DocType.CARDRECORD]) || // Card interaction history
            id.startsWith(DocTypePrefixes[DocType.SCHEDULED_CARD]) || // Scheduled reviews
            id === BaseUser.DOC_IDS.COURSE_REGISTRATIONS || // Course registrations
            id === BaseUser.DOC_IDS.CLASSROOM_REGISTRATIONS || // Classroom registrations
            id === BaseUser.DOC_IDS.CONFIG // User config
          );
        })
        .map((row) => ({ _id: row.id, _rev: row.value.rev, _deleted: true }));

      if (docsToDelete.length > 0) {
        await localDB.bulkDocs(docsToDelete);
      }

      // Reinitialize to create fresh default documents
      await this.init();

      return { status: Status.ok };
    } catch (error) {
      logger.error('Failed to reset user data:', error);
      return {
        status: Status.error,
        error: error instanceof Error ? error.message : 'Unknown error during reset',
      };
    }
  }

  public async logout() {
    if (!this.syncStrategy.canAuthenticate()) {
      // For strategies that don't support authentication, just switch to guest
      this._username = await this.syncStrategy.getCurrentUsername();
      await this.init();
      return { ok: true };
    }

    const ret = await this.syncStrategy.logout!();
    // return to 'guest' mode
    this._username = await this.syncStrategy.getCurrentUsername();
    await this.init();

    return ret;
  }

  public async get<T>(id: string): Promise<T & PouchDB.Core.RevisionIdMeta> {
    return this.localDB.get<T>(id);
  }

  public update<T extends PouchDB.Core.Document<object>>(id: string, update: Update<T>) {
    return this.updateQueue.update(id, update);
  }

  public async getCourseRegistrationsDoc(): Promise<
    CourseRegistrationDoc & PouchDB.Core.IdMeta & PouchDB.Core.GetMeta
  > {
    logger.debug(`Fetching courseRegistrations for ${this.getUsername()}`);

    let ret;

    try {
      const regDoc = await this.localDB.get<CourseRegistrationDoc>(
        BaseUser.DOC_IDS.COURSE_REGISTRATIONS
      );
      return regDoc;
    } catch (e) {
      const err = e as PouchError;
      if (err.status === 404) {
        await this.localDB.put<CourseRegistrationDoc>({
          _id: BaseUser.DOC_IDS.COURSE_REGISTRATIONS,
          courses: [],
          studyWeight: {},
        });
        ret = await this.getCourseRegistrationsDoc();
      } else {
        throw new Error(
          `Unexpected error ${JSON.stringify(e)} in getOrCreateCourseRegistrationDoc...`
        );
      }
    }

    return ret;
  }

  public async getActiveCourses() {
    const reg = await this.getCourseRegistrationsDoc();
    return reg.courses.filter((c) => {
      return c.status === undefined || c.status === 'active';
    });
  }

  /**
   * Returns a promise of the card IDs that the user has
   * a scheduled review for.
   *
   */
  public async getActiveCards() {
    const keys = getStartAndEndKeys(DocTypePrefixes[DocType.SCHEDULED_CARD]);

    const reviews = await this.remoteDB.allDocs<ScheduledCard>({
      startkey: keys.startkey,
      endkey: keys.endkey,
      include_docs: true,
    });

    return reviews.rows.map((r) => {
      return {
        courseID: r.doc!.courseId,
        cardID: r.doc!.cardId,
      };
    });
  }

  public async getActivityRecords(): Promise<ActivityRecord[]> {
    try {
      const hist = await this.getHistory();

      const allRecords: ActivityRecord[] = [];
      if (!Array.isArray(hist)) {
        logger.error('getHistory did not return an array:', hist);
        return allRecords;
      }

      // Sample the first few records to understand structure
      let sampleCount = 0;

      for (let i = 0; i < hist.length; i++) {
        try {
          if (hist[i] && Array.isArray(hist[i]!.records)) {
            hist[i]!.records.forEach((record: CardRecord) => {
              try {
                // Skip this record if timeStamp is missing
                if (!record.timeStamp) {
                  return;
                }

                let timeStamp;

                // Handle different timestamp formats
                if (typeof record.timeStamp === 'object') {
                  // It's likely a Moment object
                  if (typeof record.timeStamp.toDate === 'function') {
                    // It's definitely a Moment object
                    timeStamp = record.timeStamp.toISOString();
                  } else if (record.timeStamp instanceof Date) {
                    // It's a Date object
                    timeStamp = record.timeStamp.toISOString();
                  } else {
                    // Log a sample of unknown object types, but don't flood console
                    if (sampleCount < 3) {
                      logger.warn('Unknown timestamp object type:', record.timeStamp);
                      sampleCount++;
                    }
                    return;
                  }
                } else if (typeof record.timeStamp === 'string') {
                  // It's already a string, but make sure it's a valid date
                  const date = new Date(record.timeStamp);
                  if (isNaN(date.getTime())) {
                    return; // Invalid date string
                  }
                  timeStamp = record.timeStamp;
                } else if (typeof record.timeStamp === 'number') {
                  // Assume it's a Unix timestamp (milliseconds since epoch)
                  timeStamp = new Date(record.timeStamp).toISOString();
                } else {
                  // Unknown type, skip
                  return;
                }

                allRecords.push({
                  timeStamp,
                  courseID: record.courseID || 'unknown',
                  cardID: record.cardID || 'unknown',
                  timeSpent: record.timeSpent || 0,
                  type: 'card_view',
                });
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
              } catch (err) {
                // Silently skip problematic records to avoid flooding logs
              }
            });
          }
        } catch (err) {
          logger.error('Error processing history item:', err);
        }
      }

      logger.debug(`Found ${allRecords.length} activity records`);
      return allRecords;
    } catch (err) {
      logger.error('Error in getActivityRecords:', err);
      return [];
    }
  }

  private async getReviewstoDate(targetDate: Moment, course_id?: string) {
    const keys = getStartAndEndKeys(DocTypePrefixes[DocType.SCHEDULED_CARD]);

    const reviews = await this.remoteDB.allDocs<ScheduledCard>({
      startkey: keys.startkey,
      endkey: keys.endkey,
      include_docs: true,
    });

    log(
      `Fetching ${this._username}'s scheduled reviews${
        course_id ? ` for course ${course_id}` : ''
      }.`
    );
    return reviews.rows
      .filter((r) => {
        if (r.id.startsWith(DocTypePrefixes[DocType.SCHEDULED_CARD])) {
          const date = moment.utc(
            r.id.substr(DocTypePrefixes[DocType.SCHEDULED_CARD].length),
            REVIEW_TIME_FORMAT
          );
          if (targetDate.isAfter(date)) {
            if (course_id === undefined || r.doc!.courseId === course_id) {
              return true;
            }
          }
        }
      })
      .map((r) => r.doc!);
  }

  public async getReviewsForcast(daysCount: number) {
    const time = moment.utc().add(daysCount, 'days');
    return this.getReviewstoDate(time);
  }

  public async getPendingReviews(course_id?: string) {
    const now = moment.utc();
    return this.getReviewstoDate(now, course_id);
  }

  public async getScheduledReviewCount(course_id: string): Promise<number> {
    return (await this.getPendingReviews(course_id)).length;
  }

  public async getRegisteredCourses() {
    const regDoc = await this.getCourseRegistrationsDoc();
    return regDoc.courses.filter((c) => {
      return !c.status || c.status === 'active' || c.status === 'maintenance-mode';
    });
  }

  public async getCourseRegDoc(courseID: string) {
    const regDocs = await this.getCourseRegistrationsDoc();
    const ret = regDocs.courses.find((c) => c.courseID === courseID);
    if (ret) {
      return ret;
    } else {
      throw new Error(`Course registration not found for course ID: ${courseID}`);
    }
  }

  public async registerForCourse(course_id: string, previewMode: boolean = false) {
    return this.getCourseRegistrationsDoc()
      .then((doc: CourseRegistrationDoc) => {
        const status = previewMode ? 'preview' : 'active';
        logger.debug(`Registering for ${course_id} with status: ${status}`);

        const regItem: CourseRegistration = {
          status: status,
          courseID: course_id,
          user: true,
          admin: false,
          moderator: false,
          elo: {
            global: {
              score: 1000,
              count: 0,
            },
            tags: {},
            misc: {},
          },
        };

        if (
          doc.courses.filter((course) => {
            return course.courseID === regItem.courseID;
          }).length === 0
        ) {
          log(`It's a new course registration!`);
          doc.courses.push(regItem);
          doc.studyWeight[course_id] = 1;
        } else {
          doc.courses.forEach((c) => {
            log(`Found the previously registered course!`);
            if (c.courseID === course_id) {
              c.status = status;
            }
          });
        }

        return this.localDB.put<CourseRegistrationDoc>(doc);
      })
      .catch((e) => {
        log(`Registration failed because of: ${JSON.stringify(e)}`);
        throw e;
      });
  }
  public async dropCourse(course_id: string, dropStatus: CourseRegistration['status'] = 'dropped') {
    return this.getCourseRegistrationsDoc().then((doc) => {
      let index: number = -1;
      for (let i = 0; i < doc.courses.length; i++) {
        if (doc.courses[i].courseID === course_id) {
          index = i;
        }
      }

      if (index !== -1) {
        // remove from the relative-weighting of course study
        delete doc.studyWeight[course_id];
        // set drop status
        doc.courses[index].status = dropStatus;
      } else {
        throw new Error(
          `User ${this.getUsername()} is not currently registered for course ${course_id}`
        );
      }

      return this.localDB.put<CourseRegistrationDoc>(doc);
    });
  }

  public async getCourseInterface(courseId: string): Promise<UsrCrsDataInterface> {
    return new UsrCrsData(this, courseId);
  }

  public async getUserEditableCourses() {
    let courseIDs: string[] = [];

    const registeredCourses = await this.getCourseRegistrationsDoc();

    courseIDs = courseIDs.concat(
      registeredCourses.courses.map((course) => {
        return course.courseID;
      })
    );

    const cfgs = await Promise.all(
      courseIDs.map(async (id) => {
        return await getCredentialledCourseConfig(id);
      })
    );
    return cfgs;
  }

  public async getConfig(): Promise<UserConfig & PouchDB.Core.IdMeta & PouchDB.Core.GetMeta> {
    const defaultConfig: PouchDB.Core.Document<UserConfig> = {
      _id: BaseUser.DOC_IDS.CONFIG,
      darkMode: false,
      likesConfetti: false,
      sessionTimeLimit: 5,
    };

    try {
      const cfg = await this.localDB.get<UserConfig>(BaseUser.DOC_IDS.CONFIG);
      logger.debug('Raw config from DB:', cfg);

      return cfg;
    } catch (e) {
      const err = e as PouchError;
      if (err.name && err.name === 'not_found') {
        await this.localDB.put<UserConfig>(defaultConfig);
        return this.getConfig();
      } else {
        logger.error(`Error setting user default config:`, e);
        throw new Error(`Error returning the user's configuration: ${JSON.stringify(e)}`);
      }
    }
  }

  public async setConfig(items: Partial<UserConfig>) {
    logger.debug(`Setting Config items ${JSON.stringify(items)}`);

    const c = await this.getConfig();
    const put = await this.localDB.put<UserConfig>({
      ...c,
      ...items,
    });

    if (put.ok) {
      logger.debug(`Config items set: ${JSON.stringify(items)}`);
    } else {
      logger.error(`Error setting config items: ${JSON.stringify(put)}`);
    }
  }

  /**
   *
   * This function should be called *only* by the pouchdb datalayer provider
   * auth store.
   *
   *
   * Anyone else seeking the current user should use the auth store's
   * exported `getCurrentUser` method.
   *
   */
  public static async instance(syncStrategy: SyncStrategy, username?: string): Promise<BaseUser> {
    if (username) {
      BaseUser._instance = new BaseUser(username, syncStrategy);
      await BaseUser._instance.init();
      return BaseUser._instance;
    } else if (BaseUser._instance && BaseUser._initialized) {
      // log(`USER.instance() returning user ${BaseUser._instance._username}`);
      return BaseUser._instance;
    } else if (BaseUser._instance) {
      return new Promise((resolve) => {
        (function waitForUser() {
          if (BaseUser._initialized) {
            return resolve(BaseUser._instance);
          } else {
            setTimeout(waitForUser, 50);
          }
        })();
      });
    } else {
      const guestUsername = await syncStrategy.getCurrentUsername();
      BaseUser._instance = new BaseUser(guestUsername, syncStrategy);
      await BaseUser._instance.init();
      return BaseUser._instance;
    }
  }

  private constructor(username: string, syncStrategy: SyncStrategy) {
    BaseUser._initialized = false;
    this._username = username;
    this.syncStrategy = syncStrategy;
    this.setDBandQ();
  }

  private setDBandQ() {
    this.localDB = getLocalUserDB(this._username);
    this.remoteDB = this.syncStrategy.setupRemoteDB(this._username);
    // writeDB follows local-first pattern: static mode writes to local, CouchDB writes to remote/local as appropriate
    this.writeDB = this.syncStrategy.getWriteDB
      ? this.syncStrategy.getWriteDB(this._username)
      : this.localDB;
    this.updateQueue = new UpdateQueue(this.localDB, this.writeDB);
  }

  private async init() {
    BaseUser._initialized = false;

    // Skip admin user
    if (this._username === 'admin') {
      BaseUser._initialized = true;
      return;
    }

    this.setDBandQ();

    this.syncStrategy.startSync(this.localDB, this.remoteDB);
    this.applyDesignDocs().catch((error) => {
      log(`Error in applyDesignDocs background task: ${error}`);
      if (error && typeof error === 'object') {
        log(`Full error details in applyDesignDocs: ${JSON.stringify(error)}`);
      }
    });
    this.deduplicateReviews().catch((error) => {
      log(`Error in deduplicateReviews background task: ${error}`);
      if (error && typeof error === 'object') {
        log(`Full error details in background task: ${JSON.stringify(error)}`);
      }
    });
    BaseUser._initialized = true;
  }

  private static designDocs: DesignDoc[] = [
    {
      _id: '_design/reviewCards',
      views: {
        reviewCards: {
          map: `function (doc) {
            if (doc._id && doc._id.indexOf('card_review') === 0 && doc.courseId && doc.cardId) {
              emit(doc._id, doc.courseId + '-' + doc.cardId);
            }
          }`,
        },
      },
    },
  ];

  private async applyDesignDocs() {
    log(`Starting applyDesignDocs for user: ${this._username}`);
    log(`Remote DB name: ${this.remoteDB.name || 'unknown'}`);

    if (this._username === 'admin') {
      // Skip admin user
      log('Skipping design docs for admin user');
      return;
    }

    log(`Applying ${BaseUser.designDocs.length} design docs`);
    for (const doc of BaseUser.designDocs) {
      log(`Applying design doc: ${doc._id}`);
      try {
        // Try to get existing doc
        try {
          const existingDoc = await this.remoteDB.get(doc._id);
          // Update existing doc
          await this.remoteDB.put({
            ...doc,
            _rev: existingDoc._rev,
          });
        } catch (e: unknown) {
          if (e instanceof Error && e.name === 'not_found') {
            // Create new doc
            await this.remoteDB.put(doc);
          } else {
            throw e; // Re-throw unexpected errors
          }
        }
      } catch (error: unknown) {
        if ((error as any).name && (error as any).name === 'conflict') {
          logger.warn(`Design doc ${doc._id} update conflict - will retry`);
          // Wait a bit and try again
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await this.applyDesignDoc(doc); // Recursive retry
        } else {
          logger.error(`Failed to apply design doc ${doc._id}:`, error);
          throw error;
        }
      }
    }
  }

  // Helper method for single doc update with retry
  private async applyDesignDoc(doc: DesignDoc, retries = 3): Promise<void> {
    try {
      const existingDoc = await this.remoteDB.get(doc._id);
      await this.remoteDB.put({
        ...doc,
        _rev: existingDoc._rev,
      });
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'conflict' && retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.applyDesignDoc(doc, retries - 1);
      }
      throw e;
    }
  }

  /**
   * Logs a record of the user's interaction with the card and returns the card's
   * up-to-date history
   *
   * // [ ] #db-refactor extract to a smaller scope - eg, UserStudySession
   *
   * @param record the recent recorded interaction between user and card
   * @returns The updated state of the card's CardHistory data
   */

  public async putCardRecord<T extends CardRecord>(
    record: T
  ): Promise<CardHistory<CardRecord> & PouchDB.Core.RevisionIdMeta> {
    const cardHistoryID = getCardHistoryID(record.courseID, record.cardID);
    // stringify the current record to make it writable to couchdb
    record.timeStamp = moment.utc(record.timeStamp).toString() as unknown as Moment;

    try {
      const cardHistory = await this.update<CardHistory<T>>(
        cardHistoryID,
        function (h: CardHistory<T>) {
          h.records.push(record);
          h.bestInterval = h.bestInterval || 0;
          h.lapses = h.lapses || 0;
          h.streak = h.streak || 0;
          return h;
        }
      );

      // Convert timestamps to moment objects
      cardHistory.records = cardHistory.records.map<T>((record) => {
        const ret: T = {
          ...(record as object),
        } as T;
        ret.timeStamp = moment.utc(record.timeStamp);
        return ret;
      });
      return cardHistory;
    } catch (e) {
      const reason = e as PouchError;
      if (reason.status === 404) {
        try {
          const initCardHistory: CardHistory<T> = {
            _id: cardHistoryID,
            cardID: record.cardID,
            courseID: record.courseID,
            records: [record],
            lapses: 0,
            streak: 0,
            bestInterval: 0,
          };
          const putResult = await this.writeDB.put<CardHistory<T>>(initCardHistory);
          return { ...initCardHistory, _rev: putResult.rev };
        } catch (creationError) {
          throw new Error(`Failed to create CardHistory for ${cardHistoryID}. Reason: ${creationError}`);
        }
      } else {
        throw new Error(`putCardRecord failed because of:
  name:${reason.name}
  error: ${reason.error}
  message: ${reason.message}`);
      }
    }
  }

  private async deduplicateReviews() {
    try {
      log('Starting deduplication of scheduled reviews...');
      log(`Remote DB name: ${this.remoteDB.name || 'unknown'}`);
      log(`Write DB name: ${this.writeDB.name || 'unknown'}`);
      /**
       * Maps the qualified-id of a scheduled review card to
       * the docId of the same scheduled review.
       *
       * EG: {
       *  courseId-cardId: 'card_review_2021-06--17:12:165'
       * }
       */
      const reviewsMap: { [index: string]: string } = {};
      const duplicateDocIds: string[] = [];

      log(
        `Attempting to query remoteDB for reviewCards/reviewCards. Database: ${this.remoteDB.name || 'unknown'}`
      );
      const scheduledReviews = await this.remoteDB.query<{
        id: string;
        value: string;
      }>('reviewCards/reviewCards');

      log(`Found ${scheduledReviews.rows.length} scheduled reviews to process`);

      // First pass: identify duplicates
      scheduledReviews.rows.forEach((r) => {
        const qualifiedCardId = r.value; // courseId-cardId
        const docId = r.key; // card_review_2021-06--17:12:165

        if (reviewsMap[qualifiedCardId]) {
          // this card is scheduled more than once! mark the earlier one for deletion
          log(`Found duplicate scheduled review for card: ${qualifiedCardId}`);
          log(
            `Marking earlier review ${reviewsMap[qualifiedCardId]} for deletion, keeping ${docId}`
          );
          duplicateDocIds.push(reviewsMap[qualifiedCardId]);
          // replace with the later-dated scheduled review
          reviewsMap[qualifiedCardId] = docId;
        } else {
          // note that this card is scheduled for review
          reviewsMap[qualifiedCardId] = docId;
        }
      });

      // Second pass: remove duplicates
      if (duplicateDocIds.length > 0) {
        log(`Removing ${duplicateDocIds.length} duplicate reviews...`);
        const deletePromises = duplicateDocIds.map(async (docId) => {
          try {
            const doc = await this.remoteDB.get(docId);
            await this.writeDB.remove(doc);
            log(`Successfully removed duplicate review: ${docId}`);
          } catch (error) {
            log(`Failed to remove duplicate review ${docId}: ${error}`);
          }
        });

        await Promise.all(deletePromises);
        log(`Deduplication complete. Processed ${duplicateDocIds.length} duplicates`);
      } else {
        log('No duplicate reviews found');
      }
    } catch (error) {
      log(`Error during review deduplication: ${error}`);
      if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
        log(
          `Database not found (404) during review deduplication. Database: ${this.remoteDB.name || 'unknown'}`
        );
        log(
          `This might indicate the user database doesn't exist or the reviewCards view isn't available`
        );
      }
      // Log full error details for debugging
      if (error && typeof error === 'object') {
        log(`Full error details: ${JSON.stringify(error)}`);
      }
    }
  }

  /**
   * Returns a promise of the card IDs that the user has
   * encountered in the past.
   *
   * @param course_id optional specification of individual course
   */
  async getSeenCards(course_id?: string) {
    let prefix = DocTypePrefixes[DocType.CARDRECORD];
    if (course_id) {
      prefix += course_id;
    }
    const docs = await filterAllDocsByPrefix(this.localDB, prefix, {
      include_docs: false,
    });
    // const docs = await this.localDB.allDocs({});
    const ret: PouchDB.Core.DocumentId[] = [];
    docs.rows.forEach((row) => {
      if (row.id.startsWith(DocTypePrefixes[DocType.CARDRECORD])) {
        ret.push(row.id.substr(DocTypePrefixes[DocType.CARDRECORD].length));
      }
    });
    return ret;
  }

  /**
   *
   * @returns A promise of the cards that the user has seen in the past.
   */
  async getHistory() {
    const cards = await filterAllDocsByPrefix<CardHistory<CardRecord>>(
      this.remoteDB,
      DocTypePrefixes[DocType.CARDRECORD],
      {
        include_docs: true,
        attachments: false,
      }
    );
    return cards.rows.map((r) => r.doc);
  }

  async updateCourseSettings(course_id: string, settings: UserCourseSetting[]) {
    void this.getCourseRegistrationsDoc().then((doc) => {
      const crs = doc.courses.find((c) => c.courseID === course_id);
      if (crs) {
        if (crs.settings === null || crs.settings === undefined) {
          crs.settings = {};
        }
        settings.forEach((setting) => {
          crs!.settings![setting.key] = setting.value;
        });
      }

      return this.localDB.put(doc);
    });
  }
  async getCourseSettings(course_id: string) {
    const regDoc = await this.getCourseRegistrationsDoc();
    const crsDoc = regDoc.courses.find((c) => c.courseID === course_id);

    if (crsDoc) {
      return crsDoc.settings;
    } else {
      throw new Error(`getCourseSettings Failed:
      User is not registered for course ${course_id}`);
    }
  }

  private async getOrCreateClassroomRegistrationsDoc(): Promise<
    ClassroomRegistrationDoc & PouchDB.Core.IdMeta & PouchDB.Core.GetMeta
  > {
    let ret;

    try {
      ret = await this.remoteDB.get<ClassroomRegistrationDoc>(
        BaseUser.DOC_IDS.CLASSROOM_REGISTRATIONS
      );
    } catch (e) {
      const err = e as PouchError;

      if (err.status === 404) {
        // doc does not exist. Create it and then run this fcn again.
        await this.writeDB.put<ClassroomRegistrationDoc>({
          _id: BaseUser.DOC_IDS.CLASSROOM_REGISTRATIONS,
          registrations: [],
        });
        ret = await this.getOrCreateClassroomRegistrationsDoc();
      } else {
        // Properly serialize error information
        const errorDetails = {
          name: err.name,
          status: err.status,
          message: err.message,
          reason: err.reason,
          error: err.error,
        };

        logger.error(
          'Database error in getOrCreateClassroomRegistrationsDoc (private method):',
          errorDetails
        );

        throw new Error(
          `Database error accessing classroom registrations: ${err.message || err.name || 'Unknown error'} (status: ${err.status})`
        );
      }
    }

    logger.debug(`Returning classroom registrations doc: ${JSON.stringify(ret)}`);
    return ret;
  }

  /**
   * Retrieves the list of active classroom IDs where the user is registered as a student.
   *
   * @returns Promise<string[]> - Array of classroom IDs, or empty array if classroom
   *                              registration document is unavailable due to database errors
   *
   * @description This method gracefully handles database connectivity issues by returning
   *              an empty array when the classroom registrations document cannot be accessed.
   *              This ensures that users can still access other application features even
   *              when classroom functionality is temporarily unavailable.
   */
  public async getActiveClasses(): Promise<string[]> {
    try {
      return (await this.getOrCreateClassroomRegistrationsDoc()).registrations
        .filter((c) => c.registeredAs === 'student')
        .map((c) => c.classID);
    } catch (error) {
      logger.warn(
        'Failed to load classroom registrations, continuing without classroom data:',
        error
      );
      // Return empty array so user can still access other features
      return [];
    }
  }

  public async scheduleCardReview(review: {
    user: string;
    course_id: string;
    card_id: PouchDB.Core.DocumentId;
    time: Moment;
    scheduledFor: ScheduledCard['scheduledFor'];
    schedulingAgentId: ScheduledCard['schedulingAgentId'];
  }) {
    return scheduleCardReviewLocal(this.writeDB, review);
  }
  public async removeScheduledCardReview(reviewId: string): Promise<void> {
    return removeScheduledCardReviewLocal(this.writeDB, reviewId);
  }

  public async registerForClassroom(
    _classId: string,
    _registerAs: 'student' | 'teacher' | 'aide' | 'admin'
  ): Promise<PouchDB.Core.Response> {
    return registerUserForClassroom(this._username, _classId, _registerAs);
  }

  public async dropFromClassroom(classId: string): Promise<PouchDB.Core.Response> {
    return dropUserFromClassroom(this._username, classId);
  }
  public async getUserClassrooms(): Promise<ClassroomRegistrationDoc> {
    return getUserClassrooms(this._username);
  }

  public async updateUserElo(courseId: string, elo: CourseElo): Promise<PouchDB.Core.Response> {
    return updateUserElo(this._username, courseId, elo);
  }
}

// function accomodateGuest(): {
//   username: string;
//   firstVisit: boolean;
// } {
//   const dbUUID = 'dbUUID';
//   let firstVisit: boolean;

//   if (localStorage.getItem(dbUUID) !== null) {
//     firstVisit = false;
//     console.log(`Returning guest ${localStorage.getItem(dbUUID)} "logging in".`);
//   } else {
//     firstVisit = true;
//     const uuid = generateUUID();
//     localStorage.setItem(dbUUID, uuid);
//     console.log(`Accommodating a new guest with account: ${uuid}`);
//   }

//   return {
//     username: GuestUsername + localStorage.getItem(dbUUID),
//     firstVisit: firstVisit,
//   };

//   // pilfered from https://stackoverflow.com/a/8809472/1252649
//   function generateUUID() {
//     let d = new Date().getTime();
//     if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
//       d += performance.now(); // use high-precision timer if available
//     }
//     return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
//       // tslint:disable-next-line:no-bitwise
//       const r = (d + Math.random() * 16) % 16 | 0;
//       d = Math.floor(d / 16);
//       // tslint:disable-next-line:no-bitwise
//       return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
//     });
//   }
// }

const userCoursesDoc = 'CourseRegistrations';
const userClassroomsDoc = 'ClassroomRegistrations';

async function getOrCreateClassroomRegistrationsDoc(
  user: string
): Promise<ClassroomRegistrationDoc & PouchDB.Core.IdMeta & PouchDB.Core.GetMeta> {
  let ret;

  try {
    ret = await getLocalUserDB(user).get<ClassroomRegistrationDoc>(userClassroomsDoc);
  } catch (e) {
    const err = e as PouchError;

    if (err.status === 404) {
      // doc does not exist. Create it and then run this fcn again.
      await getLocalUserDB(user).put<ClassroomRegistrationDoc>({
        _id: userClassroomsDoc,
        registrations: [],
      });
      ret = await getOrCreateClassroomRegistrationsDoc(user);
    } else {
      // Properly serialize error information
      const errorDetails = {
        name: err.name,
        status: err.status,
        message: err.message,
        reason: err.reason,
        error: err.error,
      };

      logger.error(
        'Database error in getOrCreateClassroomRegistrationsDoc (standalone function):',
        errorDetails
      );

      throw new Error(
        `Database error accessing classroom registrations: ${err.message || err.name || 'Unknown error'} (status: ${err.status})`
      );
    }
  }

  return ret;
}

async function getOrCreateCourseRegistrationsDoc(
  user: string
): Promise<CourseRegistrationDoc & PouchDB.Core.IdMeta & PouchDB.Core.GetMeta> {
  let ret;

  try {
    ret = await getLocalUserDB(user).get<CourseRegistrationDoc>(userCoursesDoc);
  } catch (e) {
    const err = e as PouchError;
    if (err.status === 404) {
      // doc does not exist. Create it and then run this fcn again.
      await getLocalUserDB(user).put<CourseRegistrationDoc>({
        _id: userCoursesDoc,
        courses: [],
        studyWeight: {},
      });
      ret = await getOrCreateCourseRegistrationsDoc(user);
    } else {
      throw new Error(
        `Unexpected error ${JSON.stringify(e)} in getOrCreateCourseRegistrationDoc...`
      );
    }
  }

  return ret;
}

export async function updateUserElo(user: string, course_id: string, elo: CourseElo) {
  const regDoc = await getOrCreateCourseRegistrationsDoc(user);
  const course = regDoc.courses.find((c) => c.courseID === course_id)!;
  course.elo = elo;
  return getLocalUserDB(user).put(regDoc);
}

export async function registerUserForClassroom(
  user: string,
  classID: string,
  registerAs: 'student' | 'teacher' | 'aide' | 'admin'
) {
  log(`Registering user: ${user} in course: ${classID}`);
  return getOrCreateClassroomRegistrationsDoc(user).then((doc) => {
    const regItem = {
      classID: classID,
      registeredAs: registerAs,
    };

    if (
      doc.registrations.filter((reg) => {
        return reg.classID === regItem.classID && reg.registeredAs === regItem.registeredAs;
      }).length === 0
    ) {
      doc.registrations.push(regItem);
    } else {
      log(`User ${user} is already registered for class ${classID}`);
    }

    return getLocalUserDB(user).put(doc);
  });
}

export async function dropUserFromClassroom(user: string, classID: string) {
  return getOrCreateClassroomRegistrationsDoc(user).then((doc) => {
    let index: number = -1;

    for (let i = 0; i < doc.registrations.length; i++) {
      if (doc.registrations[i].classID === classID) {
        index = i;
      }
    }

    if (index !== -1) {
      doc.registrations.splice(index, 1);
    }
    return getLocalUserDB(user).put(doc);
  });
}

export async function getUserClassrooms(user: string) {
  return getOrCreateClassroomRegistrationsDoc(user);
}
