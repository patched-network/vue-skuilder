import { log } from 'util';
import { CreateCourse } from '@vue-skuilder/common';
import CouchDB, { SecurityObject } from '../couchdb/index.js';
import { postProcessCourse } from '../attachment-preprocessing/index.js';
import AsyncProcessQueue from '../utils/processQueue.js';
import nano from 'nano';

import logger from '@/logger.js';
import { CourseLookup } from '@vue-skuilder/db';
import { courseDBDesignDocs } from '../design-docs.js';

function getCourseDBName(courseID: string): string {
  return `coursedb-${courseID}`;
}

/**
 * Inserts a design document into a course database.
 * @param courseID - The ID of the course database.
 * @param doc
 */
function insertDesignDoc(
  courseID: string,
  doc: {
    _id: string;
  }
): void {
  const courseDB = CouchDB.use(courseID);

  courseDB
    .get(doc._id)
    .then((priorDoc) => {
      void courseDB.insert({
        ...doc,
        _rev: priorDoc._rev,
      });
    })
    .catch(() => {
      void courseDB
        .insert(doc)
        .catch((e) => {
          log(
            `Error inserting design doc ${doc._id} in course-${courseID}: ${e}`
          );
        })
        .then((resp) => {
          if (resp && resp.ok) {
            log(`CourseDB design doc inserted into course-${courseID}`);
          }
        });
    });
}

export async function initCourseDBDesignDocInsert(): Promise<void> {
  const courses = await CourseLookup.allCourses();
  courses.forEach((c) => {
    // Insert design docs
    courseDBDesignDocs.forEach((dd) => {
      insertDesignDoc(getCourseDBName(c._id), dd);
    });

    // Update security object for public courses
    const courseDB = CouchDB.use<CourseConfig>(getCourseDBName(c._id));
    courseDB
      .get('CourseConfig')
      .then((configDoc) => {
        if (configDoc.public === true) {
          const secObj: SecurityObject = {
            admins: {
              names: [],
              roles: [],
            },
            members: {
              names: [], // Empty array for public courses to allow all users access
              roles: [],
            },
          };
          courseDB
            // @ts-expect-error allow insertion of _security document.
            //                  db scoped as ConfigDoc to make the read easier.
            .insert(secObj as nano.MaybeDocument, '_security')
            .then(() => {
              logger.info(
                `Updated security settings for public course ${c._id}`
              );
            })
            .catch((e) => {
              logger.error(
                `Error updating security for public course ${c._id}: ${e}`
              );
            });
        }
      })
      .catch((e) => {
        logger.error(`Error getting CourseConfig for ${c._id}: ${e}`);
      });
  });
}

type CourseConfig = CreateCourse['data'];

async function createCourse(cfg: CourseConfig): Promise<any> {
  cfg.courseID = await CourseLookup.add(cfg.name);

  if (!cfg.courseID) {
    throw new Error('Course ID not found');
  }

  const courseDBName: string = getCourseDBName(cfg.courseID);
  const dbCreation = await CouchDB.db.create(courseDBName);

  if (dbCreation.ok) {
    const courseDB = CouchDB.use(courseDBName);

    courseDB
      .insert({
        _id: 'CourseConfig',
        ...cfg,
      })
      .catch((e) => {
        logger.error(
          `Error inserting CourseConfig for course ${cfg.courseID}:`,
          e
        );
      });

    // insert the tags, elo, etc view docs
    courseDBDesignDocs.forEach((doc) => {
      courseDB.insert(doc).catch((e) => {
        logger.error(
          `Error inserting design doc for course ${cfg.courseID}:`,
          e
        );
      });
    });

    // Configure security for both public and private courses
    const secObj: SecurityObject = {
      admins: {
        names: [],
        roles: [],
      },
      members: {
        names: cfg.public ? [] : [cfg.creator], // Empty array for public courses to allow all users access
        roles: [],
      },
    };

    courseDB
      .insert(secObj as nano.MaybeDocument, '_security')
      .then(() => {
        logger.info(
          `Successfully set security for ${
            cfg.public ? 'public' : 'private'
          } course ${cfg.courseID}`
        );
      })
      .catch((e) => {
        logger.error(
          `Error inserting security object for course ${cfg.courseID}:`,
          e
        );
      });

    // Design documents including validation are inserted via courseDBDesignDocs
    logger.info(
      `Validation design document will be inserted for course ${cfg.courseID}`
    );
  }

  // follow the course so that user-uploaded content goes through
  // post-processing
  postProcessCourse(cfg.courseID);

  return {
    ok: dbCreation.ok,
    status: 'ok',
    courseID: cfg.courseID,
  };
}

export type CreateCourseResp = CreateCourse['response'];

export const CourseCreationQueue = new AsyncProcessQueue<
  // @ts-expect-error [I do not know why this thinks is is broken or why it works.]
  CreateCourse['data'],
  CreateCourse['response']
>(createCourse);
