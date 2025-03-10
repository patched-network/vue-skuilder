import { Status } from '@vue-skuilder/common';
import { ENV } from '@vue-skuilder/common';
import { GuestUsername } from '@/constants';
import { UserConfig } from '../stores/useConfigStore';
import { CourseElo } from '../tutor/Elo';
import moment, { Moment } from 'moment';
import pouch from './pouchdb-setup';
import { log } from '@/logshim';
import { getCourseConfigs } from './courseDB';
import {
  filterAllDocsByPrefix,
  getStartAndEndKeys,
  hexEncode,
  pouchDBincludeCredentialsConfig,
  REVIEW_PREFIX,
  REVIEW_TIME_FORMAT,
  updateGuestAccountExpirationDate,
} from './index';
import UpdateQueue, { Update } from './updateQueue';
import { CardHistory, CardRecord } from './types';
import { PouchError } from '../types/pouchdb';

const cardHistoryPrefix = 'cardH-';
const remoteStr: string = ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + 'skuilder';

console.log(`Connecting to remote: ${remoteStr}`);

let remoteCouchRootDB: PouchDB.Database;
try {
  remoteCouchRootDB = new pouch(remoteStr, {
    skip_setup: true,
  });
} catch (error) {
  console.error('Failed to initialize remote CouchDB connection:', error);
  throw new Error(`Failed to initialize CouchDB: ${JSON.stringify(error)}`);
}

interface DesignDoc {
  _id: string;
  views: {
    [viewName: string]: {
      map: string; // String representation of the map function
    };
  };
}

export async function doesUserExist(name: string) {
  try {
    const user = await remoteCouchRootDB.getUser(name);
    log(`user: ${user._id}`);
    return true;
  } catch (err) {
    log(`User error: ${err}`);
    return false;
  }
}

export interface ScheduledCard {
  _id: PouchDB.Core.DocumentId;

  /**
   * The docID of the card to be reviewed
   */
  cardId: PouchDB.Core.DocumentId;
  /**
   * The ID of the course
   */
  courseId: string;
  /**
   * The time at which the card becomes eligible for review.
   *
   * (Should probably be UTC adjusted so that performance is
   * not wonky across time zones)
   */
  reviewTime: Moment;

  /**
   * The time at which this scheduled event was created.
   */
  scheduledAt: Moment;

  /**
   * Classifying whether this card is scheduled on behalf of a
   * user-registered course or by as assigned content from a
   * user-registered classroom
   */
  scheduledFor: 'course' | 'classroom';

  /**
   * The ID of the course or classroom that requested this card
   */
  schedulingAgentId: string;
}

/**
 * The current logged-in user
 */
export class User {
  private static _instance: User;
  private static _initialized: boolean = false;
  static readonly DOC_IDS = {
    CONFIG: 'CONFIG',
    COURSE_REGISTRATIONS: 'CourseRegistrations',
    CLASSROOM_REGISTRATIONS: 'ClassroomRegistrations',
  };

  private email: string;
  private _username: string;
  public get username(): string {
    return this._username;
  }

  private remoteDB: PouchDB.Database;
  private localDB: PouchDB.Database;
  private updateQueue: UpdateQueue;

  public async createAccount(username: string, password: string) {
    const ret = {
      status: Status.ok,
      error: '',
    };

    if (!this._username.startsWith(GuestUsername)) {
      throw new Error(
        `Cannot create a new account while logged in:
Currently logged-in as ${this._username}.`
      );
    } else {
      try {
        const signupRequest = await remoteCouchRootDB.signUp(username, password);

        if (signupRequest.ok) {
          log(`CREATEACCOUNT: logging out of ${this.username}`);
          const logoutResult = await remoteCouchRootDB.logOut();
          log(`CREATEACCOUNT: logged out: ${logoutResult.ok}`);
          const loginResult = await remoteCouchRootDB.logIn(username, password);
          log(`CREATEACCOUNT: logged in as new user: ${loginResult.ok}`);
          const newLocal = getLocalUserDB(username);
          const newRemote = getUserDB(username);
          this._username = username;

          this.localDB.replicate.to(newLocal).on('complete', () => {
            newLocal.replicate.to(newRemote).on('complete', async () => {
              log('CREATEACCOUNT: Attempting to destroy guest localDB');
              await clearLocalGuestDB();

              // reset this.local & this.remote DBs
              this.init();
            });
          });
        } else {
          ret.status = Status.error;
          ret.error = '';
          console.log(`Signup not OK: ${JSON.stringify(signupRequest)}`);
          // throw signupRequest;
          return ret;
        }
      } catch (e) {
        const err = e as PouchError;
        if (err.reason === 'Document update conflict.') {
          ret.error = 'This username is taken!';
          ret.status = Status.error;
        }
        console.log(`Error on signup: ${JSON.stringify(e)}`);
        return ret;
      }
    }

    return ret;
  }
  public async login(username: string, password: string) {
    if (!this._username.startsWith(GuestUsername)) {
      throw new Error(`Cannot change accounts while logged in.
      Log out of account ${this.username} before logging in as ${username}.`);
    }

    const loginResult = await remoteCouchRootDB.logIn(username, password);
    if (loginResult.ok) {
      log(`Logged in as ${username}`);
      this._username = username;
      localStorage.removeItem('dbUUID');
      await this.init();
    } else {
      log(`Login ERROR as ${username}`);
    }
    return loginResult;
  }
  public async logout() {
    // end session w/ couchdb
    const ret = await this.remoteDB.logOut();
    // return to 'guest' mode
    this._username = GuestUsername;
    await this.init();

    return ret;
  }

  public update<T extends PouchDB.Core.Document<object>>(id: string, update: Update<T>) {
    return this.updateQueue.update(id, update);
  }

  public async getCourseRegistrationsDoc(): Promise<
    CourseRegistrationDoc & PouchDB.Core.IdMeta & PouchDB.Core.GetMeta
  > {
    console.log(`Fetching courseRegistrations for ${this.username}`);

    let ret;

    try {
      ret = await this.localDB.get<CourseRegistrationDoc>(userCoursesDoc);
    } catch (e) {
      const err = e as PouchError;
      if (err.status === 404) {
        // doc does not exist. Create it and then run this fcn again.
        await this.localDB.put<CourseRegistrationDoc>({
          _id: userCoursesDoc,
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
    const keys = getStartAndEndKeys(REVIEW_PREFIX);

    const reviews = await this.remoteDB.allDocs<ScheduledCard>({
      startkey: keys.startkey,
      endkey: keys.endkey,
      include_docs: true,
    });

    return reviews.rows.map((r) => `${r.doc!.courseId}-${r.doc!.cardId}`);
  }

  private async getReviewstoDate(targetDate: Moment, course_id?: string) {
    const keys = getStartAndEndKeys(REVIEW_PREFIX);

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
        if (r.id.startsWith(REVIEW_PREFIX)) {
          const date = moment.utc(r.id.substr(REVIEW_PREFIX.length), REVIEW_TIME_FORMAT);
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
    return regDocs.courses.find((c) => c.courseID === courseID);
  }

  public async registerForCourse(course_id: string, previewMode: boolean = false) {
    return this.getCourseRegistrationsDoc()
      .then((doc: CourseRegistrationDoc) => {
        const status = previewMode ? 'preview' : 'active';
        console.log(`Registering for ${course_id} with status: ${status}`);

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
          `User ${this.username} is not currently registered for course ${course_id}`
        );
      }

      return this.localDB.put<CourseRegistrationDoc>(doc);
    });
  }

  public async getUserEditableCourses() {
    let courseIDs: string[] = [];

    const registeredCourses = await this.getCourseRegistrationsDoc();

    courseIDs = courseIDs.concat(
      registeredCourses.courses.map((course) => {
        return course.courseID;
      })
    );

    return getCourseConfigs(courseIDs);
  }

  public async getConfig(): Promise<UserConfig & PouchDB.Core.IdMeta & PouchDB.Core.GetMeta> {
    const defaultConfig: PouchDB.Core.Document<UserConfig> = {
      _id: User.DOC_IDS.CONFIG,
      darkMode: false,
      likesConfetti: false,
    };

    try {
      const cfg = await this.localDB.get<UserConfig>(User.DOC_IDS.CONFIG);
      console.log('Raw config from DB:', cfg);

      return cfg;
    } catch (e) {
      const err = e as PouchError;
      if (err.name && err.name === 'not_found') {
        await this.localDB.put<UserConfig>(defaultConfig);
        return this.getConfig();
      } else {
        console.error(e);
        throw new Error(`Error returning the user's configuration: ${JSON.stringify(e)}`);
      }
    }
  }

  public async setConfig(items: Partial<UserConfig>) {
    console.log(`Setting Config items ${JSON.stringify(items)}`);

    const c = await this.getConfig();
    const put = await this.localDB.put<UserConfig>({
      ...c,
      ...items,
    });

    if (put.ok) {
      console.log(`Config items set: ${JSON.stringify(items)}`);
    } else {
      console.error(`Error setting config items: ${JSON.stringify(put)}`);
    }
  }

  /**
   * @deprecated
   * @deprecated
   * This function should be called *only* by the pinia auth store.
   *
   * Anyone else seeking the current user should use the auth store's
   * exported `getCurrentUser` method.
   * @deprecated
   * @deprecated
   */
  public static async instance(username?: string): Promise<User> {
    if (username) {
      User._instance = new User(username);
      await User._instance.init();
      return User._instance;
    } else if (User._instance && User._initialized) {
      // log(`USER.instance() returning user ${User._instance._username}`);
      return User._instance;
    } else if (User._instance) {
      return new Promise((resolve) => {
        (function waitForUser() {
          if (User._initialized) {
            return resolve(User._instance);
          } else {
            setTimeout(waitForUser, 50);
          }
        })();
      });
    } else {
      User._instance = new User(GuestUsername);
      await User._instance.init();
      return User._instance;
    }
  }

  private constructor(username: string) {
    User._initialized = false;
    this._username = username;
  }

  private async init() {
    User._initialized = false;
    // if (this._username === GuestUsername) {
    //   const acc = accomodateGuest();
    //   this._username = acc.username;
    //   if (acc.firstVisit) {
    //     await this.createAccount(this._username, this._username);
    //   }
    //   await console.login(this._username, this._username);
    // }
    this.localDB = getLocalUserDB(this._username);
    if (this._username === GuestUsername) {
      this.remoteDB = getLocalUserDB(this._username);
    } else {
      this.remoteDB = getUserDB(this._username);
    }
    this.updateQueue = new UpdateQueue(this.localDB);

    pouch.sync(this.localDB, this.remoteDB, {
      live: true,
      retry: true,
    });
    this.applyDesignDocs();
    this.deduplicateReviews();
    User._initialized = true;
  }

  private static designDocs: DesignDoc[] = [
    {
      _id: '_design/reviewCards',
      views: {
        reviewCards: {
          map: function (doc: PouchDB.Core.Document<object>) {
            if (doc._id.indexOf('card_review') === 0) {
              type ReviewCard = {
                _id: string;
                courseId: string;
                cardId: string;
              };

              const copy: ReviewCard = doc as ReviewCard;
              emit(copy._id, copy.courseId + '-' + copy.cardId);
            }
          }.toString(),
        },
      },
    },
  ];

  private async applyDesignDocs() {
    for (const doc of User.designDocs) {
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
        if (error instanceof Error && error.name === 'conflict') {
          console.warn(`Design doc ${doc._id} update conflict - will retry`);
          // Wait a bit and try again
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await this.applyDesignDoc(doc); // Recursive retry
        } else {
          console.error(`Failed to apply design doc ${doc._id}:`, error);
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

  private async deduplicateReviews() {
    /**
     * Maps the qualified-id of a scheduled review card to
     * the docId of the same scheduled review.
     *
     * EG: {
     *  courseId-cardId: 'card_review_2021-06--17:12:165
     * }
     */
    const reviewsMap: { [index: string]: string } = {};

    const scheduledReviews = await this.remoteDB.query<{
      id: string;
      value: string;
    }>('reviewCards');

    scheduledReviews.rows.forEach((r) => {
      if (reviewsMap[r.value]) {
        // this card is scheduled more than once! delete this scheduled review
        log(`Removing duplicate scheduled review for card: ${r.value}`);
        log(`Replacing review ${reviewsMap[r.value]} with ${r.key}`);
        this.remoteDB
          .get(reviewsMap[r.value])
          .then((doc) => {
            // remove the already-hashed review, since it is the earliest one
            // (prevents continual loop of short-scheduled reviews)
            this.remoteDB.remove(doc);
          })
          .then(() => {
            // replace with the later-dated scheduled review
            reviewsMap[r.value] = r.key;
          });
      } else {
        // note that this card is scheduled for review
        reviewsMap[r.value] = r.key;
      }
    });
  }

  /**
   * Returns a promise of the card IDs that the user has
   * encountered in the past.
   *
   * @param course_id optional specification of individual course
   */
  async getSeenCards(course_id?: string) {
    let prefix = cardHistoryPrefix;
    if (course_id) {
      prefix += course_id;
    }
    const docs = await filterAllDocsByPrefix(this.localDB, prefix, {
      include_docs: false,
    });
    // const docs = await this.localDB.allDocs({});
    const ret: PouchDB.Core.DocumentId[] = [];
    docs.rows.forEach((row) => {
      if (row.id.startsWith(cardHistoryPrefix)) {
        ret.push(row.id.substr(cardHistoryPrefix.length));
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
      cardHistoryPrefix,
      {
        include_docs: true,
        attachments: false,
      }
    );
    return cards.rows.map((r) => r.doc);
  }

  async updateCourseSettings(
    course_id: string,
    settings: {
      key: string;
      value: string | number | boolean;
    }[]
  ) {
    this.getCourseRegistrationsDoc().then((doc) => {
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
      ret = await getUserDB(this._username).get<ClassroomRegistrationDoc>(userClassroomsDoc);
    } catch (e) {
      const err = e as PouchError;
      if (err.status === 404) {
        // doc does not exist. Create it and then run this fcn again.
        await getUserDB(this._username).put<ClassroomRegistrationDoc>({
          _id: userClassroomsDoc,
          registrations: [],
        });
        ret = await this.getOrCreateClassroomRegistrationsDoc();
      } else {
        throw new Error(
          `Unexpected error ${JSON.stringify(e)} in getOrCreateClassroomRegistrationDoc...`
        );
      }
    }

    console.log(`Returning classroom registrations doc: ${JSON.stringify(ret)}`);
    return ret;
  }

  public async getActiveClasses(): Promise<string[]> {
    return (await this.getOrCreateClassroomRegistrationsDoc()).registrations
      .filter((c) => c.registeredAs === 'student')
      .map((c) => c.classID);
  }
}

export function getLocalUserDB(username: string): PouchDB.Database {
  return new pouch(`userdb-${username}`, {
    adapter: 'idb',
  });
}

async function clearLocalGuestDB() {
  const docs = await getLocalUserDB(GuestUsername).allDocs({
    limit: 1000,
    include_docs: true,
  });

  docs.rows.forEach((r) => {
    log(`CREATEACCOUNT: Deleting ${r.id}`);
    getLocalUserDB(GuestUsername).remove(r.doc!);
  });
  delete localStorage.dbUUID;
}

export function getUserDB(username: string): PouchDB.Database {
  const guestAccount: boolean = false;
  // console.log(`Getting user db: ${username}`);

  const hexName = hexEncode(username);
  const dbName = `userdb-${hexName}`;
  log(`Fetching user database: ${dbName} (${username})`);

  // odd construction here the result of a bug in the
  // interaction between pouch, pouch-auth.
  // see: https://github.com/pouchdb-community/pouchdb-authentication/issues/239
  const ret = new pouch(
    ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + dbName,
    pouchDBincludeCredentialsConfig
  );
  if (guestAccount) {
    updateGuestAccountExpirationDate(ret);
  }

  return ret;
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

export interface CourseRegistration {
  status?: 'active' | 'dropped' | 'maintenance-mode' | 'preview';
  courseID: string;
  admin: boolean;
  moderator: boolean;
  user: boolean;
  settings?: {
    [setting: string]: string | number | boolean;
  };
  elo: number | CourseElo;
}

interface StudyWeights {
  [courseID: string]: number;
}

export interface CourseRegistrationDoc {
  courses: CourseRegistration[];
  studyWeight: StudyWeights;
}

export type ClassroomRegistrationDesignation = 'student' | 'teacher' | 'aide' | 'admin';

interface ClassroomRegistration {
  classID: string;
  registeredAs: ClassroomRegistrationDesignation;
}

interface ClassroomRegistrationDoc {
  registrations: ClassroomRegistration[];
}

async function getOrCreateClassroomRegistrationsDoc(
  user: string
): Promise<ClassroomRegistrationDoc & PouchDB.Core.IdMeta & PouchDB.Core.GetMeta> {
  let ret;

  try {
    ret = await getUserDB(user).get<ClassroomRegistrationDoc>(userClassroomsDoc);
  } catch (e) {
    const err = e as PouchError;

    if (err.status === 404) {
      // doc does not exist. Create it and then run this fcn again.
      await getUserDB(user).put<ClassroomRegistrationDoc>({
        _id: userClassroomsDoc,
        registrations: [],
      });
      ret = await getOrCreateClassroomRegistrationsDoc(user);
    } else {
      throw new Error(
        `Unexpected error ${JSON.stringify(e)} in getOrCreateClassroomRegistrationDoc...`
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
    ret = await getUserDB(user).get<CourseRegistrationDoc>(userCoursesDoc);
  } catch (e) {
    const err = e as PouchError;
    if (err.status === 404) {
      // doc does not exist. Create it and then run this fcn again.
      await getUserDB(user).put<CourseRegistrationDoc>({
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
  return getUserDB(user).put(regDoc);
}

export async function registerUserForClassroom(
  user: string,
  classID: string,
  registerAs: ClassroomRegistrationDesignation
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

    return getUserDB(user).put(doc);
  });
}

/**
 * This noop exists to facilitate writing couchdb filter fcns
 */
function emit(x: unknown, y: unknown): void {
  console.log(`noop:`, x, y);
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
    return getUserDB(user).put(doc);
  });
}

export async function getUserClassrooms(user: string) {
  return getOrCreateClassroomRegistrationsDoc(user);
}
