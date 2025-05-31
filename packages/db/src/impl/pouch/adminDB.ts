import pouch from './pouchdb-setup';
import { ENV } from '@/factory';
import {
  pouchDBincludeCredentialsConfig,
  getStartAndEndKeys,
  getCredentialledCourseConfig,
  updateCredentialledCourseConfig,
} from '.';
import { TeacherClassroomDB, ClassroomLookupDB } from './classroomDB';
import { PouchError } from './types';

import { AdminDBInterface } from '@/core';
import CourseLookup from './courseLookupDB';
import logger from '@/utils/logger';

export class AdminDB implements AdminDBInterface {
  private usersDB!: PouchDB.Database;

  constructor() {
    // [ ] execute a check here against credentials, and throw an error
    //     if the user is not an admin
    this.usersDB = new pouch(
      ENV.COUCHDB_SERVER_PROTOCOL + '://' + ENV.COUCHDB_SERVER_URL + '_users',
      pouchDBincludeCredentialsConfig
    );
  }

  public async getUsers() {
    return (
      await this.usersDB.allDocs({
        include_docs: true,
        ...getStartAndEndKeys('org.couchdb.user:'),
      })
    ).rows.map((r) => r.doc!);
  }

  public async getCourses() {
    const list = await CourseLookup.allCourses();
    return await Promise.all(
      list.map((c) => {
        return getCredentialledCourseConfig(c._id);
      })
    );
  }
  public async removeCourse(id: string) {
    // remove the indexer
    const delResp = await CourseLookup.delete(id);

    // set the 'CourseConfig' to 'deleted'
    const cfg = await getCredentialledCourseConfig(id);
    cfg.deleted = true;
    const isDeletedResp = await updateCredentialledCourseConfig(id, cfg);

    return {
      ok: delResp.ok && isDeletedResp.ok,
      id: delResp.id,
      rev: delResp.rev,
    };
  }

  public async getClassrooms() {
    // const joincodes =
    const uuids = (
      await ClassroomLookupDB().allDocs<{ uuid: string }>({
        include_docs: true,
      })
    ).rows.map((r) => r.doc!.uuid);
    logger.debug(uuids);

    const promisedCRDbs: TeacherClassroomDB[] = [];
    for (let i = 0; i < uuids.length; i++) {
      try {
        const db = await TeacherClassroomDB.factory(uuids[i]);
        promisedCRDbs.push(db);
      } catch (e) {
        const err = e as PouchError;
        if (err.error && err.error === 'not_found') {
          logger.warn(`db ${uuids[i]} not found`);
        }
      }
    }

    const dbs = await Promise.all(promisedCRDbs);
    return dbs.map((db) => {
      return {
        ...db.getConfig(),
        _id: db._id,
      };
    });
  }
}
