import Nano from 'nano';
import process from 'process';
import ENV from '../utils/env.js'; 
import logger from '../logger.js';

const url = ENV.COUCHDB_SERVER;
const protocol: string = ENV.COUCHDB_PROTOCOL;

const admin = {
  username: ENV.COUCHDB_ADMIN,
  password: ENV.COUCHDB_PASSWORD,
};
const credentialCouchURL = `${protocol}://${admin.username}:${admin.password}@${url}`;

logger.info('WORKING DIRECTORY: ' + process.cwd());
logger.info(
  `CouchDB url: ${url}
    protocol: ${protocol}
    credentials:
    \tusername: ${admin.username}
    \tpassword: *****
    credUrl: ${protocol}://${admin.username}:*****@${url}
    `
);

const CouchDB = Nano(credentialCouchURL);

export async function useOrCreateCourseDB(courseID: string): Promise<Nano.DocumentScope<unknown>> {
  return useOrCreateDB(`coursedb-${courseID}`);
}

interface NanoError extends Error {
  statusCode?: number;
}

export async function useOrCreateDB<T>(dbName: string): Promise<Nano.DocumentScope<T>> {
  const ret = CouchDB.use<T>(dbName);

  try {
    await ret.info();
    return ret;
  } catch {
    try {
      await CouchDB.db.create(dbName);
      return ret;
      } catch (error: unknown) {
        const createErr = error as NanoError;
        // If error is "database already exists", return existing db
        if (createErr.statusCode === 412) {
        return ret;
      }
      throw createErr;
    }
  }
}

export async function docCount(dbName: string): Promise<number> {
  const db = await useOrCreateDB(dbName);
  const info = await db.info();
  return info.doc_count;
}

export interface SecurityObject extends Nano.MaybeDocument {
  admins: {
    names: string[];
    roles: string[];
  };
  members: {
    names: string[];
    roles: string[];
  };
}

export const COUCH_URL_WITH_PROTOCOL = protocol + '://' + process.env.COUCHDB_SERVER;

export default CouchDB;
