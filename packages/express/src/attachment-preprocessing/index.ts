import { getCouchDB } from '../couchdb/index.js';
import nano from 'nano';
import { normalize } from './normalize.js';
import AsyncProcessQueue, { Result } from '../utils/processQueue.js';
import logger from '../logger.js';
import { CourseLookup } from '@vue-skuilder/db';
import ENV from '../utils/env.js';

// @ts-expect-error [todo]
const Q = new AsyncProcessQueue<AttachmentProcessingRequest, Result>(
  processDocAttachments
);

interface DocForProcessing extends nano.DocumentGetResponse {
  processed?: boolean | string[];
  _attachments: {
    [key: string]: {
      content_type: string;
      data?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      digest?: string;
      length?: number;
      revpos?: number;
      stub?: boolean;
    };
  };
}

/**
 * Apply post-processing to a course database. Runs continuously.
 * @param courseID
 */
export function postProcessCourse(courseID: string): void {
  try {
    logger.info(`postProcessCourse: Starting for courseID: ${courseID}`);

    const crsString = `coursedb-${courseID}`;
    logger.debug(`postProcessCourse: Using database name: ${crsString}`);

    // Get database instance
    const db = getCouchDB().use(crsString);
    
    // Test database existence before setting up change listener
    db.info().catch((e: unknown) => {
      if (e && typeof e === 'object' && 'status' in e && e.status === 404) {
        logger.error(`postProcessCourse: Database "${crsString}" does not exist. Expected database name may be incorrect for courseID: ${courseID}`);
        return;
      }
      logger.error(`postProcessCourse: Error checking database "${crsString}": ${e}`);
      // Log full error details for debugging
      if (e && typeof e === 'object') {
        logger.error(`postProcessCourse: Full error details for ${crsString}:`, e);
      }
    });

    const courseFilter = filterFactory(courseID);

    db.changesReader
      .start({
        // feed: 'continuous',
        includeDocs: false,
      })
      .on('change', (change: nano.DatabaseChangesResultItem) => {
        courseFilter(change).catch((e) => {
          logger.error(`Error in CourseFilter for ${courseID}: ${e}`);
        });
      })
      .on('error', (err: Error) => {
        logger.error(`Error in changes feed for ${crsString}: ${err}`);
      });
  } catch (e) {
    logger.error(`Error in postProcessCourse: ${e}`);
  }
}

/**
 * Connect to CouchDB, monitor changes to uploaded card data,
 * perform post-processing on uploaded media
 */
export default async function postProcess(courseIDs?: string[]): Promise<void> {
  try {
    logger.info(`Following all course databases for changes...`);

    let processedCourseIds = new Set<string>();

    if (courseIDs && courseIDs.length > 0) {
      processedCourseIds = new Set(courseIDs);
    } else {
      // Existing behavior for platform-ui courses
      try {
        const courses = await CourseLookup.allCourseWare();

        for (const course of courses) {
          try {
            postProcessCourse(course._id);
            processedCourseIds.add(`coursedb-${course._id}`);
          } catch (e) {
            logger.error(`Error processing course ${course._id}: ${e}`);
            throw e;
          }
        }
      } catch (e: unknown) {
        // Handle CourseLookup.allCourseWare() failure gracefully
        if (e && typeof e === 'object' && 'error' in e && e.error === 'not_found') {
          logger.warn('Course lookup database not found - skipping platform course discovery');
        } else {
          logger.error(`Error fetching course list from CourseLookup: ${e}`);
          if (e && typeof e === 'object' && 'status' in e && e.status === 404) {
            logger.error(`Database connection failed - this might indicate a database name mismatch or connection issue`);
          }
        }
        // Continue to studio mode discovery even if platform courses fail
      }
    }

    // Studio mode: discover additional databases not in coursedb-lookup
    if (ENV.NODE_ENV === 'studio') {
      logger.info(
        'Studio mode detected: scanning for additional course databases...'
      );

      try {
        const allDbs = await getCouchDB().db.list();
        logger.debug(`All databases found: ${allDbs.join(', ')}`);
        
        const studioDbs = allDbs.filter(
          (db) => db.startsWith('coursedb-') && !processedCourseIds.has(db)
        );
        
        logger.info(`Found ${studioDbs.length} potential studio databases: ${studioDbs.join(', ')}`);
        logger.debug(`Already processed course IDs: ${Array.from(processedCourseIds).join(', ')}`);

        for (const studioDb of studioDbs) {
          const courseId = studioDb.replace('coursedb-', '');
          logger.debug(`Checking studio database: ${studioDb} (courseId: ${courseId})`);

          try {
            logger.debug(`Calling hasCourseConfig for: ${studioDb}`);
            if (await hasCourseConfig(studioDb)) {
              logger.info(
                `Starting postprocessing for studio database: ${studioDb}`
              );
              postProcessCourse(courseId);
            } else {
              logger.debug(`Skipping ${studioDb}: no course config found`);
            }
          } catch (e) {
            logger.error(`Error processing studio database ${studioDb}: ${e}`);
            // Log the full error object for debugging
            if (e && typeof e === 'object') {
              logger.error(`Error details for ${studioDb}:`, e);
            }
          }
        }
      } catch (e) {
        logger.error(`Error discovering studio databases: ${e}`);
      }
    }
  } catch (e) {
    logger.error(`Error in postProcess: ${e}`);
  }
}

function filterFactory(courseID: string) {
  const databaseName = `coursedb-${courseID}`;
  logger.debug(`filterFactory: Creating filter for database: ${databaseName}`);
  const courseDatabase = getCouchDB().use<DocForProcessing>(databaseName);

  return async function filterChanges(
    changeItem: nano.DatabaseChangesResultItem
  ) {
    try {
      const docNoAttachments = await courseDatabase.get(changeItem.id, {
        attachments: false,
      });

      if (
        docNoAttachments._attachments &&
        Object.keys(docNoAttachments._attachments).length > 0 &&
        (docNoAttachments['processed'] === undefined ||
          docNoAttachments['processed'] === false)
      ) {
        const doc = await courseDatabase.get(changeItem.id, {
          attachments: true,
        });
        const processingRequest: AttachmentProcessingRequest = {
          courseID,
          docID: doc._id,
          fields: [],
        };
        const atts = doc._attachments;
        for (const attachment in atts) {
          const content_type: string = atts[attachment]['content_type'];
          logger.info(
            `Course: ${courseID}\n\tAttachment ${attachment} in:\n\t${doc._id}\n should be processed...`
          );

          if (content_type.includes('audio')) {
            processingRequest.fields.push({
              name: attachment,
              mimetype: content_type,
            });
          }
        }
        Q.addRequest(processingRequest);
      }
    } catch (e) {
      logger.error(`Error processing doc ${changeItem.id}: ${e}`);
    }
  };
}

async function processDocAttachments(
  request: AttachmentProcessingRequest
): Promise<Result> {
  if (request.fields.length == 0) {
    logger.info(`No attachments to process for ${request.docID}`);
    return {
      error: 'No attachments to process',
      ok: true,
      status: 'warning',
    };
  }
  const courseDatabase = getCouchDB().use<DocForProcessing>(
    `coursedb-${request.courseID}`
  );

  const doc = await courseDatabase.get(request.docID, {
    attachments: true,
    att_encoding_info: true,
  });

  for (const field of request.fields) {
    logger.info(`Converting ${field.name}`);
    const attachment = doc._attachments[field.name].data;
    if (field.mimetype.includes('audio')) {
      try {
        const converted = await normalize(attachment);
        field.returnData = converted;
      } catch (e) {
        logger.info(`Exception caught: ${e}`);
        throw e;
      }
    }
  }

  logger.info('Conversions finished');

  request.fields.forEach((field) => {
    logger.info(`Replacing doc Data for ${field.name}`);
    if (doc['processed']) {
      (doc['processed'] as string[]).push(field.name);
    } else {
      doc['processed'] = [field.name];
    }
    doc._attachments[field.name].data = field.returnData;
  });

  // request was a noop.
  // Mark as processed in order to avoid inifinte loop
  if (request.fields.length === 0) {
    doc['processed'] = true;
  }

  const resp = (await courseDatabase.insert(doc)) as unknown as Result;
  resp.status = 'ok';

  logger.info(`Processing request reinsert result: ${JSON.stringify(resp)}`);
  return resp;
}

// interface _DatabaseChangesResultItemWithDoc
//   extends nano.DatabaseChangesResultItem {
//   doc: nano.DocumentGetResponse;
//   courseID: string;
// }

interface AttachmentProcessingRequest {
  courseID: string;
  docID: string;
  fields: ProcessingField[];
}
interface ProcessingField {
  name: string;
  mimetype: string;
  returnData?: string;
}

/**
 * Check if a database contains course configuration (indicating it's a valid course database)
 */
async function hasCourseConfig(databaseName: string): Promise<boolean> {
  try {
    logger.debug(`hasCourseConfig: Accessing database: ${databaseName}`);
    const db = getCouchDB().use(databaseName);

    // First check if database exists by trying to get info
    try {
      await db.info();
      logger.debug(`hasCourseConfig: Database ${databaseName} exists, checking for course config`);
    } catch (infoError: unknown) {
      if (infoError && typeof infoError === 'object' && 'status' in infoError && infoError.status === 404) {
        logger.debug(`hasCourseConfig: Database ${databaseName} does not exist (404)`);
        return false;
      }
      logger.warn(`hasCourseConfig: Error getting info for database ${databaseName}: ${infoError}`);
      throw infoError;
    }

    // Try to find a course configuration document
    // Course databases should have documents with course metadata
    const result = await db.find({
      selector: {
        $or: [
          { type: 'course' },
          { shape: { $exists: true } },
          { course_id: { $exists: true } },
          { courseID: { $exists: true } },
        ],
      },
      limit: 1,
    });

    const hasConfig = result.docs && result.docs.length > 0;
    logger.debug(`hasCourseConfig: Database ${databaseName} has course config: ${hasConfig}`);
    return hasConfig;
  } catch (e: unknown) {
    // Handle specific database not found errors
    if (e && typeof e === 'object' && 'error' in e && e.error === 'not_found') {
      logger.debug(`hasCourseConfig: Database ${databaseName} does not exist (not_found error)`);
      return false;
    }
    
    logger.error(`hasCourseConfig: Error checking course config for ${databaseName}: ${e}`);
    // Log full error details for debugging
    if (e && typeof e === 'object') {
      logger.error(`hasCourseConfig: Full error details for ${databaseName}:`, e);
    }
    return false;
  }
}
