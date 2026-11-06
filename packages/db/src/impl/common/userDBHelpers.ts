// packages/db/src/impl/common/userDBHelpers.ts

import moment from 'moment';
import { logger } from '../../util/logger';
import { ScheduledCard } from '@db/core/types/user';
import pouch from '../couch/pouchdb-setup';
import { getDbPath } from '../../util/dataDirectory';
import { makeScheduledCardId } from './userDBKeys';

// PouchDB-backed helpers. The PouchDB-free ones (ids, key ranges) are in
// userDBKeys.ts.

const log = (s: any) => {
  logger.info(s);
};

export function updateGuestAccountExpirationDate(guestDB: PouchDB.Database<object>) {
  const currentTime = moment.utc();
  const expirationDate: string = currentTime.add(2, 'months').toISOString();
  const expiryDocID: string = 'GuestAccountExpirationDate';

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

/**
 * Get local user database with appropriate adapter for environment
 */
export function getLocalUserDB(username: string): PouchDB.Database {
  // // Choose adapter based on environment
  //
  // Not certain of this is required. Let's let pouch's auto detection
  // handle it until we specifically know we need to intervene.
  //
  // let adapter: string;
  // if (typeof window !== 'undefined') {
  //   // Browser environment - use IndexedDB
  //   adapter = 'idb';
  // } else {
  //   // Node.js environment (tests) - use memory adapter
  //   adapter = 'memory';
  // }

  const dbName = `userdb-${username}`;
  
  // Use proper data directory in Node.js, browser will use IndexedDB
  if (typeof window === 'undefined') {
    // Node.js environment - use filesystem with proper app data directory
    return new pouch(getDbPath(dbName), {});
  } else {
    // Browser environment - use default (IndexedDB)
    return new pouch(dbName, {});
  }
}

/**
 * Schedule a card review (strategy-agnostic version)
 */
export function scheduleCardReviewLocal(
  userDB: PouchDB.Database,
  review: {
    card_id: PouchDB.Core.DocumentId;
    time: moment.Moment;
    course_id: string;
    scheduledFor: ScheduledCard['scheduledFor'];
    schedulingAgentId: ScheduledCard['schedulingAgentId'];
  }
) {
  const now = moment.utc();
  logger.info(`Scheduling for review in: ${review.time.diff(now, 'h') / 24} days`);
  void userDB.put<ScheduledCard>({
    _id: makeScheduledCardId(review.time),
    cardId: review.card_id,
    reviewTime: review.time.toISOString(),
    courseId: review.course_id,
    scheduledAt: now.toISOString(),
    scheduledFor: review.scheduledFor,
    schedulingAgentId: review.schedulingAgentId,
  });
}

/**
 * Remove a scheduled card review (strategy-agnostic version)
 */
export async function removeScheduledCardReviewLocal(
  userDB: PouchDB.Database,
  reviewDocID: string
) {
  const reviewDoc = await userDB.get(reviewDocID);
  userDB
    .remove(reviewDoc)
    .then((res) => {
      if (res.ok) {
        log(`Removed Review Doc: ${reviewDocID}`);
      }
    })
    .catch((err) => {
      log(`Failed to remove Review Doc: ${reviewDocID},\n${JSON.stringify(err)}`);
    });
}
