import { DocType, SkuilderCourseData, GuestUsername, log } from '../core/types-legacy';
import { ENV } from '@vue-skuilder/common';
// import { getCurrentUser } from '../stores/useAuthStore';
import moment, { Moment } from 'moment';
import PouchDBAuth from '@nilock2/pouchdb-authentication';
import pouch from 'pouchdb-browser';
import PouchDBFind from 'pouchdb-find';
import process from 'process';
import { getUserDB, ScheduledCard } from './userDB';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).process = process; // required as a fix for pouchdb - see #18

pouch.plugin(PouchDBAuth);
pouch.plugin(PouchDBFind);

if (ENV.DEBUG) {
  // pouch.debug.enable('pouchdb:find');
}

const expiryDocID: string = 'GuestAccountExpirationDate';

const remoteStr: string = ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + 'skuilder';

log(`Remote db: ${remoteStr}`);

const GUEST_LOCAL_DB = `userdb-${GuestUsername}`;
export const localUserDB: PouchDB.Database = new pouch(GUEST_LOCAL_DB);

export function hexEncode(str: string): string {
  let hex: string;
  let returnStr: string = '';

  for (let i = 0; i < str.length; i++) {
    hex = str.charCodeAt(i).toString(16);
    returnStr += ('000' + hex).slice(3);
  }

  return returnStr;
}
export const pouchDBincludeCredentialsConfig: PouchDB.Configuration.RemoteDatabaseConfiguration = {
  fetch(url: string | Request, opts: RequestInit): Promise<Response> {
    opts.credentials = 'include';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (pouch as any).fetch(url, opts);
  },
} as PouchDB.Configuration.RemoteDatabaseConfiguration;

function getCouchDB(dbName: string): PouchDB.Database {
  return new pouch(
    ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + dbName,
    pouchDBincludeCredentialsConfig
  );
}

export function getCourseDB(courseID: string): PouchDB.Database {
  // todo: keep a cache of opened courseDBs? need to benchmark this somehow
  return new pouch(
    ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + 'coursedb-' + courseID,
    pouchDBincludeCredentialsConfig
  );
}

export async function getLatestVersion() {
  try {
    const docs = await getCouchDB('version').allDocs({
      descending: true,
      limit: 1,
    });
    if (docs && docs.rows && docs.rows[0]) {
      return docs.rows[0].id;
    } else {
      return '0.0.0';
    }
  } catch {
    return '-1';
  }
}

/**
 * Checks the remote couchdb to see if a given username is available
 * @param username The username to be checked
 */
export async function usernameIsAvailable(username: string): Promise<boolean> {
  log(`Checking availability of ${username}`);
  const req = new XMLHttpRequest();
  const url = ENV.COUCHDB_SERVER_URL + 'userdb-' + hexEncode(username);
  req.open('HEAD', url, false);
  req.send();
  return req.status === 404;
}

export function updateGuestAccountExpirationDate(guestDB: PouchDB.Database<object>) {
  const currentTime = moment.utc();
  const expirationDate: string = currentTime.add(2, 'months').toISOString();

  guestDB
    .get(expiryDocID)
    .then((doc) => {
      guestDB.put({
        _id: expiryDocID,
        _rev: doc._rev,
        date: expirationDate,
      });
    })
    .catch(() => {
      guestDB.put({
        _id: expiryDocID,
        date: expirationDate,
      });
    });
}

export function getCourseDocs<T extends SkuilderCourseData>(
  courseID: string,
  docIDs: string[],
  options: PouchDB.Core.AllDocsOptions = {}
) {
  return getCourseDB(courseID).allDocs<T>({
    ...options,
    keys: docIDs,
  });
}

export function getCourseDoc<T extends SkuilderCourseData>(
  courseID: string,
  docID: PouchDB.Core.DocumentId,
  options: PouchDB.Core.GetOptions = {}
): Promise<T> {
  return getCourseDB(courseID).get<T>(docID, options);
}

/**
 * Returns *all* cards from the parameter courses, in
 * 'qualified' card format ("courseid-cardid")
 *
 * @param courseIDs A list of all course_ids to get cards from
 */
export async function getRandomCards(courseIDs: string[]) {
  if (courseIDs.length === 0) {
    throw new Error(`getRandomCards:\n\tAttempted to get all cards from no courses!`);
  } else {
    const courseResults = await Promise.all(
      courseIDs.map((course) => {
        return getCourseDB(course).find({
          selector: {
            docType: DocType.CARD,
          },
          limit: 1000,
        });
      })
    );

    const ret: string[] = [];
    courseResults.forEach((courseCards, index) => {
      courseCards.docs.forEach((doc) => {
        ret.push(`${courseIDs[index]}-${doc._id}`);
      });
    });

    return ret;
  }
}

export const REVIEW_PREFIX: string = 'card_review_';
export const REVIEW_TIME_FORMAT: string = 'YYYY-MM-DD--kk:mm:ss-SSS';

export function scheduleCardReview(review: {
  user: string;
  course_id: string;
  card_id: PouchDB.Core.DocumentId;
  time: Moment;
  scheduledFor: ScheduledCard['scheduledFor'];
  schedulingAgentId: ScheduledCard['schedulingAgentId'];
}) {
  const now = moment.utc();
  console.log(`Scheduling for review in: ${review.time.diff(now, 'h') / 24} days`);
  getUserDB(review.user).put<ScheduledCard>({
    _id: REVIEW_PREFIX + review.time.format(REVIEW_TIME_FORMAT),
    cardId: review.card_id,
    reviewTime: review.time,
    courseId: review.course_id,
    scheduledAt: now,
    scheduledFor: review.scheduledFor,
    schedulingAgentId: review.schedulingAgentId,
  });
}

export async function removeScheduledCardReview(user: string, reviewDocID: string) {
  const db = getUserDB(user);
  const reviewDoc = await db.get(reviewDocID);
  db.remove(reviewDoc)
    .then((res) => {
      if (res.ok) {
        log(`Removed Review Doc: ${reviewDocID}`);
      }
    })
    .catch((err) => {
      log(`Failed to remove Review Doc: ${reviewDocID},\n${JSON.stringify(err)}`);
    });
}

export function filterAllDocsByPrefix<T>(
  db: PouchDB.Database,
  prefix: string,
  opts?: PouchDB.Core.AllDocsOptions
) {
  // see couchdb docs 6.2.2:
  //   Guide to Views -> Views Collation -> String Ranges
  const options: PouchDB.Core.AllDocsWithinRangeOptions = {
    startkey: prefix,
    endkey: prefix + '\ufff0',
    include_docs: true,
  };

  if (opts) {
    Object.assign(options, opts);
  }
  return db.allDocs<T>(options);
}

export function getStartAndEndKeys(key: string) {
  return {
    startkey: key,
    endkey: key + '\ufff0',
  };
}

//////////////////////
// Package exports
//////////////////////

export * from './userDB';
export * from './courseDB';
export * from './courseAPI';
export * from './classroomDB';
export * from '../core/interfaces/contentSource';
export * from './adminDB';
