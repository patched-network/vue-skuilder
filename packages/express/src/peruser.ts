/**
 * Per-user database provisioning daemon.
 *
 * Replaces CouchDB's built-in couch_peruser Erlang module, which has a
 * process leak bug that causes unbounded memory growth:
 * https://github.com/apache/couchdb/issues/5871
 *
 * Watches the _users database changes feed and ensures that every user
 * has a corresponding userdb-{hex(username)} database with appropriate
 * security settings. Replays from since=0 on every startup — this is
 * cheap and removes the need to persist checkpoint state.
 */

import { getCouchDB } from './couchdb/index.js';
import logger from './logger.js';

function hexEncode(str: string): string {
  let returnStr = '';
  for (let i = 0; i < str.length; i++) {
    returnStr += ('000' + str.charCodeAt(i).toString(16)).slice(-4);
  }
  return returnStr;
}

async function ensureUserDB(username: string): Promise<void> {
  const dbName = `userdb-${hexEncode(username)}`;
  const server = getCouchDB();

  try {
    await server.db.create(dbName);
    logger.info(`peruser: created ${dbName}`);
  } catch (e: unknown) {
    if (
      e &&
      typeof e === 'object' &&
      'statusCode' in e &&
      (e as { statusCode: number }).statusCode === 412
    ) {
      // already exists — expected on replay
    } else {
      logger.error(`peruser: error creating ${dbName}:`, e);
      return;
    }
  }

  const db = server.use(dbName);
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(
      {
        admins: { names: [username], roles: [] },
        members: { names: [username], roles: [] },
      } as any,
      '_security'
    );
  } catch (e) {
    logger.error(`peruser: error setting security on ${dbName}:`, e);
  }
}

export function startPerUserProvisioning(): void {
  const usersDB = getCouchDB().use('_users');

  usersDB.changesReader
    .start({
      includeDocs: false,
      since: '0',
    })
    .on('change', (change: { id: string; deleted?: boolean }) => {
      if (!change.id.startsWith('org.couchdb.user:')) return;
      if (change.deleted) return;

      const username = change.id.replace('org.couchdb.user:', '');
      ensureUserDB(username).catch((e) => {
        logger.error(`peruser: unhandled error for ${username}:`, e);
      });
    })
    .on('error', (err: Error) => {
      logger.error('peruser: _users changes feed error:', err);
    });

  logger.info('peruser: watching _users for new accounts');
}
