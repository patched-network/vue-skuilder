import pouch from 'pouchdb';
import { ENV } from '@vue-skuilder/common';

const courseLookupDBTitle = 'coursedb-lookup';

interface CourseLookupDoc {
  _id: string;
  _rev: string;
  name: string;
  disambiguator?: string;
}

/**
 * a k-v indexes created courses.
 *
 * k: courseID
 * v: course name
 */
export default class CourseLookup {
  // [ ] this db should be read only for public, admin-write only
  static _db: PouchDB.Database = new pouch(
    ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + courseLookupDBTitle,
    {
      skip_setup: true,
    }
  );

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
      return false;
    }
  }
}
