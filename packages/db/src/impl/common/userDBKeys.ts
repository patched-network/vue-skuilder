// packages/db/src/impl/common/userDBKeys.ts
//
// Doc-id and key-range helpers for the user DB. Kept apart from
// userDBHelpers.ts, which imports pouchdb-setup: importing one of these must
// not pull PouchDB into a consumer's bundle.

import moment from 'moment';
import { DocType, DocTypePrefixes } from '../../core/types/types-legacy';

export const REVIEW_TIME_FORMAT: string = 'YYYY-MM-DD--kk:mm:ss-SSS';

/**
 * Build a ScheduledCard `_id` for the given review time.
 *
 * The id suffix is not a mere uniquifier: `getReviewstoDate` PARSES the id
 * (with {@link REVIEW_TIME_FORMAT}) to decide due-ness, so the id is the
 * datum. Anything that writes or rewrites scheduled-card docs (scheduling,
 * user-state snapshot rebasing) must construct ids through this helper —
 * a hand-rolled formatter will get moment's `kk` token (01-24 hours) wrong.
 */
export function makeScheduledCardId(reviewTime: string | Date | moment.Moment): string {
  return DocTypePrefixes[DocType.SCHEDULED_CARD] + moment.utc(reviewTime).format(REVIEW_TIME_FORMAT);
}

export function hexEncode(str: string): string {
  let hex: string;
  let returnStr: string = '';

  for (let i = 0; i < str.length; i++) {
    hex = str.charCodeAt(i).toString(16);
    returnStr += ('000' + hex).slice(3);
  }

  return returnStr;
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
    endkey: prefix + '￰',
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
    endkey: key + '￰',
  };
}
