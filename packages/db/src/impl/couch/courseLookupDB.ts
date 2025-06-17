import pouch from './pouchdb-setup';
import { ENV } from '@db/factory';
import { logger } from '../../util/logger';

const courseLookupDBTitle = 'coursedb-lookup';

interface CourseLookupDoc {
  _id: string;
  _rev: string;
  name: string;
  disambiguator?: string;
}

logger.debug(`COURSELOOKUP FILE RUNNING`);

/**
 * A Lookup table of existant courses. Each docID in this DB correspondes to a
 * course database whose name is `coursedb-{docID}`
 */
export default class CourseLookup {
  // [ ] this db should be read only for public, admin-only for write
  // Cache for the PouchDB instance
  private static _dbInstance: PouchDB.Database | null = null;

  /**
   * Static getter for the PouchDB database instance.
   * Connects using ENV variables and caches the instance.
   * Throws an error if required ENV variables are not set.
   */
  private static get _db(): PouchDB.Database {
    // Return cached instance if available
    if (this._dbInstance) {
      return this._dbInstance;
    }

    // --- Check required environment variables ---
    if (ENV.COUCHDB_SERVER_URL === 'NOT_SET' || !ENV.COUCHDB_SERVER_URL) {
      throw new Error(
        'CourseLookup.db: COUCHDB_SERVER_URL is not set. Ensure initializeDataLayer has been called with valid configuration.'
      );
    }
    if (ENV.COUCHDB_SERVER_PROTOCOL === 'NOT_SET' || !ENV.COUCHDB_SERVER_PROTOCOL) {
      throw new Error(
        'CourseLookup.db: COUCHDB_SERVER_PROTOCOL is not set. Ensure initializeDataLayer has been called with valid configuration.'
      );
    }

    // --- Construct connection options ---
    const dbUrl = `${ENV.COUCHDB_SERVER_PROTOCOL}://${ENV.COUCHDB_SERVER_URL}/${courseLookupDBTitle}`;
    const options: PouchDB.Configuration.RemoteDatabaseConfiguration = {
      skip_setup: true, // Keep the original option
      // fetch: (url, opts) => { // Optional: Add for debugging network requests
      //   console.log('PouchDB fetch:', url, opts);
      //   return pouch.fetch(url, opts);
      // }
    };

    // Add authentication if both username and password are provided
    if (ENV.COUCHDB_USERNAME && ENV.COUCHDB_PASSWORD) {
      options.auth = {
        username: ENV.COUCHDB_USERNAME,
        password: ENV.COUCHDB_PASSWORD,
      };
      logger.info(`CourseLookup: Connecting to ${dbUrl} with authentication.`);
    } else {
      logger.info(`CourseLookup: Connecting to ${dbUrl} without authentication.`);
    }

    // --- Create and cache the PouchDB instance ---
    try {
      this._dbInstance = new pouch(dbUrl, options);
      logger.info(`CourseLookup: Database instance created for ${courseLookupDBTitle}.`);
      return this._dbInstance;
    } catch (error) {
      logger.error(`CourseLookup: Failed to create PouchDB instance for ${dbUrl}`, error);
      // Reset cache attempt on failure
      this._dbInstance = null;
      // Re-throw the error to indicate connection failure
      throw new Error(
        `CourseLookup: Failed to initialize database connection: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Adds a new course to the lookup database, and returns the courseID
   * @param courseName
   * @returns
   */
  static async add(courseName: string): Promise<string> {
    const resp = await CourseLookup._db.post({
      name: courseName,
    });

    return resp.id;
  }

  /**
   * Removes a course from the index
   * @param courseID
   */
  static async delete(courseID: string): Promise<PouchDB.Core.Response> {
    const doc = await CourseLookup._db.get(courseID);
    return await CourseLookup._db.remove(doc);
  }

  static async allCourses(): Promise<CourseLookupDoc[]> {
    const resp = await CourseLookup._db.allDocs<CourseLookupDoc>({
      include_docs: true,
    });

    return resp.rows.map((row) => row.doc!);
  }

  static async updateDisambiguator(
    courseID: string,
    disambiguator?: string
  ): Promise<PouchDB.Core.Response> {
    const doc = await CourseLookup._db.get<CourseLookupDoc>(courseID);
    doc.disambiguator = disambiguator;
    return await CourseLookup._db.put(doc);
  }

  static async isCourse(courseID: string): Promise<boolean> {
    try {
      await CourseLookup._db.get(courseID);
      return true;
    } catch (error) {
      logger.info(`Courselookup failed:`, error);
      return false;
    }
  }
}
