import hashids from 'hashids';
import { log } from 'util';
import { CreateCourse } from '@vue-skuilder/common';
import CouchDB, { SecurityObject, useOrCreateDB } from '../couchdb/index.js';
import { postProcessCourse } from '../attachment-preprocessing/index.js';
import AsyncProcessQueue from '../utils/processQueue.js';
import nano from 'nano';
import { Status } from '@vue-skuilder/common';
import logger from '@/logger.js';
import { CourseLookup } from '@vue-skuilder/db';

/**
 * Fake fcn to allow usage in couchdb map fcns which, after passing
 * through `.toString()`, are applied to all courses
 */
function emit(key?: unknown, value?: unknown) {
  return [key, value];
}

function getCourseDBName(courseID: string): string {
  return `coursedb-${courseID}`;
}

const cardsByInexperienceDoc = {
  _id: '_design/cardsByInexperience',
  views: {
    cardsByInexperience: {
      // @ts-expect-error - this function needs to be plain JS in order to land correctly as a design doc function in CouchDBKs
      map: function (doc) {
        if (doc.docType && doc.docType === 'CARD') {
          if (
            doc.elo &&
            doc.elo.global &&
            typeof doc.elo.global.count == 'number'
          ) {
            emit(doc.elo.global.count, doc.elo);
          } else if (doc.elo && typeof doc.elo == 'number') {
            emit(0, doc.elo);
          } else {
            emit(0, 995 + Math.floor(10 * Math.random()));
          }
        }
      }.toString(),
    },
  },
  language: 'javascript',
};

const tagsDoc = {
  _id: '_design/getTags',
  views: {
    getTags: {
      map: `function (doc) {
                if (doc.docType && doc.docType === "TAG") {
                    for (var cardIndex in doc.taggedCards) {
                        emit(doc.taggedCards[cardIndex], {
                            docType: doc.docType,
                            name: doc.name,
                            snippit: doc.snippit,
                            wiki: '',
                            taggedCards: []
                        });
                    }
                }
            }`,
      // "mapFcn": function getTags(doc) {
      //     if (doc.docType && doc.docType === "TAG") {
      //         for (var cardIndex in doc.taggedCards) {
      //             emit(doc.taggedCards[cardIndex], {
      //                 docType: doc.docType,
      //                 name: doc.name,
      //                 snippit: doc.snippit,
      //                 wiki: '',
      //                 taggedCards: []
      //             });
      //         }
      //     }
      // }
    },
  },
  language: 'javascript',
};

const elodoc = {
  _id: '_design/elo',
  views: {
    elo: {
      map: `function (doc) {
                if (doc.docType && doc.docType === 'CARD') {
                    if (doc.elo && typeof(doc.elo) === 'number') {
                        emit(doc.elo, doc._id);
                    } else if (doc.elo && doc.elo.global) {
                        emit(doc.elo.global.score, doc._id);
                    } else if (doc.elo) {
                        emit(doc.elo.score, doc._id);
                    } else {
                        const randElo = 995 + Math.round(10 * Math.random());
                        emit(randElo, doc._id);
                    }
                }
            }`,
      // mapFcn: function eloView(doc: any) {
      //   if (doc.docType && doc.docType === 'CARD') {
      //     if (doc.elo && typeof doc.elo === 'number') {
      //       emit(doc.elo, doc._id);
      //     } else if (doc.elo) {
      //       emit(doc.elo.score, doc._id);
      //     } else {
      //       const randElo = 995 + Math.round(10 * Math.random());
      //       emit(randElo, doc._id);
      //     }
      //   }
      // },
    },
  },
  language: 'javascript',
};

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
) {
  const courseDB = CouchDB.use(courseID);

  courseDB
    .get(doc._id)
    .then((priorDoc) => {
      courseDB.insert({
        ...doc,
        _rev: priorDoc._rev,
      });
    })
    .catch(() => {
      courseDB
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

const courseDBDesignDocs: { _id: string }[] = [
  elodoc,
  tagsDoc,
  cardsByInexperienceDoc,
];

export async function initCourseDBDesignDocInsert(): Promise<void> {
  const courses = await CourseLookup.allCourses();
  courses.forEach((c) => {
    courseDBDesignDocs.forEach((dd) => {
      insertDesignDoc(getCourseDBName(c._id), dd);
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

    if (!cfg.public) {
      const secObj: SecurityObject = {
        admins: {
          names: [],
          roles: [],
        },
        members: {
          names: [cfg.creator],
          roles: [],
        },
      };

      courseDB.insert(secObj as nano.MaybeDocument, '_security').catch((e) => {
        logger.error(
          `Error inserting security object for course ${cfg.courseID}:`,
          e
        );
      });
    }
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
