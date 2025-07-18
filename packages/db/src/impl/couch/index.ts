import { ENV } from '@db/factory';
import {
  DocType,
  DocTypePrefixes,
  GuestUsername,
  log,
  SkuilderCourseData,
} from '../../core/types/types-legacy';
// import { getCurrentUser } from '../../stores/useAuthStore';
import moment, { Moment } from 'moment';
import { logger } from '@db/util/logger';

import pouch from './pouchdb-setup';

import { ScheduledCard } from '@db/core/types/user';
import process from 'process';

const isBrowser = typeof window !== 'undefined';

if (isBrowser) {
  (window as any).process = process; // required as a fix for pouchdb - see #18
}

const expiryDocID: string = 'GuestAccountExpirationDate';

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

  void guestDB
    .get(expiryDocID)
    .then((doc) => {
      return guestDB.put({
        _id: expiryDocID,
        _rev: doc._rev,
        date: expirationDate,
      });
    })
    .catch(() => {
      return guestDB.put({
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

export const REVIEW_TIME_FORMAT: string = 'YYYY-MM-DD--kk:mm:ss-SSS';

export function getCouchUserDB(username: string): PouchDB.Database {
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

export function scheduleCardReview(review: {
  user: string;
  course_id: string;
  card_id: PouchDB.Core.DocumentId;
  time: Moment;
  scheduledFor: ScheduledCard['scheduledFor'];
  schedulingAgentId: ScheduledCard['schedulingAgentId'];
}) {
  const now = moment.utc();
  logger.info(`Scheduling for review in: ${review.time.diff(now, 'h') / 24} days`);
  void getCouchUserDB(review.user).put<ScheduledCard>({
    _id: DocTypePrefixes[DocType.SCHEDULED_CARD] + review.time.format(REVIEW_TIME_FORMAT),
    cardId: review.card_id,
    reviewTime: review.time.toISOString(),
    courseId: review.course_id,
    scheduledAt: now.toISOString(),
    scheduledFor: review.scheduledFor,
    schedulingAgentId: review.schedulingAgentId,
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

export function getStartAndEndKeys(key: string): {
  startkey: string;
  endkey: string;
} {
  return {
    startkey: key,
    endkey: key + '\ufff0',
  };
}

//////////////////////
// Package exports
//////////////////////

export * from '../../core/interfaces/contentSource';
export * from './adminDB';
export * from './classroomDB';
export * from './courseAPI';
export * from './courseDB';
export * from './CouchDBSyncStrategy';
