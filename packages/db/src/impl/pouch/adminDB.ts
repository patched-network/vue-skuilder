import pouch from 'pouchdb-browser';
import { ENV } from '@vue-skuilder/common';
import { pouchDBincludeCredentialsConfig, getStartAndEndKeys } from '.';
import { getCourseList, removeCourse } from './courseDB';
import { TeacherClassroomDB, ClassroomLookupDB } from './classroomDB';
import { PouchError } from './types';

import { AdminDBInterface } from '@/core';

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
    return (await getCourseList()).rows.map((r) => r.doc!);
  }
  public async removeCourse(id: string) {
    return await removeCourse(id);
  }
  public async getClassrooms() {
    // const joincodes =
    const uuids = (
      await ClassroomLookupDB.allDocs<{ uuid: string }>({
        include_docs: true,
      })
    ).rows.map((r) => r.doc!.uuid);
    console.log(uuids);

    const promisedCRDbs: TeacherClassroomDB[] = [];
    for (let i = 0; i < uuids.length; i++) {
      try {
        const db = await TeacherClassroomDB.factory(uuids[i]);
        promisedCRDbs.push(db);
      } catch (e) {
        const err = e as PouchError;
        if (err.error && err.error === 'not_found') {
          console.log(`db ${uuids[i]} not found`);
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
