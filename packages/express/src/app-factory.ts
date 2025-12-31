import { initializeDataLayer } from '@vue-skuilder/db';
import {
  ServerRequestType as RequestEnum,
  ServerRequest,
  prepareNote55,
} from '@vue-skuilder/common';
import { CourseLookup } from '@vue-skuilder/db';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import type { CorsOptionsDelegate } from 'cors';
import type { Request, Response } from 'express';
import express from 'express';
import morgan from 'morgan';
import Nano from 'nano';
import PostProcess from './attachment-preprocessing/index.js';
import {
  ClassroomCreationQueue,
  ClassroomJoinQueue,
  ClassroomLeaveQueue,
} from './client-requests/classroom-requests.js';
import {
  CourseCreationQueue,
  initCourseDBDesignDocInsert,
} from './client-requests/course-requests.js';
import { packCourse } from './client-requests/pack-requests.js';
import { requestIsAuthenticated, getAuthenticatedUsername } from './couchdb/authentication.js';
import { getCouchDB, initializeCouchDB, useOrCreateCourseDB, useOrCreateDB } from './couchdb/index.js';
import { classroomDbDesignDoc } from './design-docs.js';
import logger from './logger.js';
import logsRouter from './routes/logs.js';
import authRouter from './routes/auth.js';
import type { ExpressServerConfig, EnvironmentConfig } from './types.js';
import { applyUsersDesignDocs } from './couchdb/userDesignDocs.js';
import { getAllowedOrigins } from './utils/origins.js';
import { globalLimiter, moderateLimiter } from './utils/rateLimiters.js';

export interface VueClientRequest extends express.Request {
  body: ServerRequest;
}

/**
 * Configuration options for creating an Express app.
 * Can be provided either as ExpressServerConfig (programmatic) or EnvironmentConfig (env vars).
 */
export type AppConfig = ExpressServerConfig | EnvironmentConfig;

/**
 * Type guard to determine if config is ExpressServerConfig (programmatic usage)
 */
function isExpressServerConfig(config: AppConfig): config is ExpressServerConfig {
  return 'couchdb' in config && typeof config.couchdb === 'object';
}

/**
 * Convert ExpressServerConfig to environment-style config for internal usage
 */
function convertToEnvConfig(config: ExpressServerConfig): EnvironmentConfig {
  return {
    COUCHDB_SERVER: config.couchdb.server,
    COUCHDB_PROTOCOL: config.couchdb.protocol,
    COUCHDB_ADMIN: config.couchdb.username,
    COUCHDB_PASSWORD: config.couchdb.password,
    VERSION: config.version,
    NODE_ENV: config.nodeEnv || 'development',
    COURSE_IDS: config.courseIDs || [],
  };
}

/**
 * Create and configure Express application with all routes and middleware.
 * This is the shared logic used by both standalone and programmatic modes.
 */
export function createExpressApp(config: AppConfig): express.Application {
  const app = express();

  // Normalize config to environment format for internal usage
  const envConfig = isExpressServerConfig(config)
    ? convertToEnvConfig(config)
    : config;

  // Initialize CouchDB connection
  initializeCouchDB(envConfig);

  // Configure CORS - use config if available, otherwise use origin whitelist
  const corsOptions: CorsOptionsDelegate = isExpressServerConfig(config) && config.cors
    ? () => config.cors!
    : (req, callback) => {
        const origin = req.headers.origin;
        const allowed = getAllowedOrigins();

        // Allow requests with no origin (same-origin, server-to-server, curl, etc.)
        if (!origin) {
          callback(null, { credentials: true, origin: true });
          return;
        }

        if (allowed.includes(origin)) {
          callback(null, { credentials: true, origin: true });
        } else {
          logger.warn(`[CORS] Rejected origin: ${origin}`);
          callback(new Error('Origin not allowed by CORS policy'), { origin: false });
        }
      };

  // Middleware setup
  app.use(cookieParser());
  app.use(express.json());
  app.use(cors(corsOptions));
  app.use(globalLimiter);
  app.use(
    morgan('combined', {
      stream: { write: (message: string) => logger.info(message.trim()) },
    })
  );
  app.use('/logs', logsRouter);
  app.use('/auth', authRouter);

  // Routes
  app.get('/courses', moderateLimiter, (_req: Request, res: Response) => {
    void (async () => {
      try {
        const courses = await CourseLookup.allCourseWare();
        res.send(courses.map((c) => `${c._id} - ${c.name}`));
      } catch (error) {
        logger.error('Error fetching courses:', error);
        res.status(500).send('Failed to fetch courses');
      }
    })();
  });

  app.get('/course/:courseID/config', moderateLimiter, (req: Request, res: Response) => {
    void (async () => {
      try {
        const courseDB = await useOrCreateCourseDB(req.params.courseID);
        const cfg = await courseDB.get('CourseConfig'); // [ ] pull courseConfig docName into global const

        res.json(cfg);
      } catch (error) {
        logger.error('Error fetching course config:', error);
        res.status(500).send('Failed to fetch course config');
      }
    })();
  });

  app.delete('/course/:courseID', moderateLimiter, (req: Request, res: Response) => {
    void (async () => {
      try {
        const courseID = req.params.courseID;
        logger.info(`[DELETE /course] Delete request for course ${courseID}`);

        // Get authenticated username
        const username = await getAuthenticatedUsername(req);
        if (!username) {
          res.status(401).json({ success: false, error: 'Not authenticated' });
          return;
        }

        // Fetch course config to check authorization
        const courseDB = await useOrCreateCourseDB(courseID);
        let courseConfig: { creator?: string; admins?: string[] };
        try {
          courseConfig = await courseDB.get('CourseConfig') as { creator?: string; admins?: string[] };
        } catch (err) {
          logger.warn(`[DELETE /course] CourseConfig not found for ${courseID}: ${err}`);
          res.status(404).json({ success: false, error: 'Course not found' });
          return;
        }

        // Check if user is creator or admin
        const isCreator = courseConfig.creator === username;
        const isAdmin = Array.isArray(courseConfig.admins) && courseConfig.admins.includes(username);

        if (!isCreator && !isAdmin) {
          logger.warn(`[DELETE /course] User ${username} not authorized to delete course ${courseID}`);
          res.status(403).json({ success: false, error: 'Not authorized to delete this course' });
          return;
        }

        logger.info(`[DELETE /course] User ${username} authorized (creator: ${isCreator}, admin: ${isAdmin})`);

        // Proceed with deletion
        const dbResp = await getCouchDB().db.destroy(`coursedb-${courseID}`);
        if (!dbResp.ok) {
          res.json({ success: false, error: dbResp });
          return;
        }

        const delResp = await CourseLookup.delete(courseID);
        if (delResp.ok) {
          logger.info(`[DELETE /course] Course ${courseID} deleted by ${username}`);
          res.json({ success: true });
        } else {
          res.json({ success: false, error: delResp });
        }
      } catch (error) {
        logger.error('Error deleting course:', error);
        res.status(500).json({ success: false, error: 'Failed to delete course' });
      }
    })();
  });

  async function postHandler(
    req: VueClientRequest,
    res: express.Response
  ): Promise<void> {
    const auth = await requestIsAuthenticated(req);
    if (auth) {
      const body = req.body;
      logger.info(
        `Authorized ${
          body.type ? body.type : '[unspecified request type]'
        } request made...`
      );

      if (body.type === RequestEnum.CREATE_CLASSROOM) {
        const id: number = ClassroomCreationQueue.addRequest(body.data);
        body.response = await ClassroomCreationQueue.getResult(id);
        res.json(body.response);
      } else if (body.type === RequestEnum.DELETE_CLASSROOM) {
        // [ ] add delete classroom request
      } else if (body.type === RequestEnum.JOIN_CLASSROOM) {
        const id: number = ClassroomJoinQueue.addRequest(body.data);
        body.response = await ClassroomJoinQueue.getResult(id);
        res.json(body.response);
      } else if (body.type === RequestEnum.LEAVE_CLASSROOM) {
        const id: number = ClassroomLeaveQueue.addRequest({
          username: req.body.user,
          ...body.data,
        });
        body.response = await ClassroomLeaveQueue.getResult(id);
        res.json(body.response);
      } else if (body.type === RequestEnum.CREATE_COURSE) {
        const id: number = CourseCreationQueue.addRequest(body.data);
        body.response = await CourseCreationQueue.getResult(id);
        res.json(body.response);
      } else if (body.type === RequestEnum.ADD_COURSE_DATA) {
        const payload = prepareNote55(
          body.data.courseID,
          body.data.codeCourse,
          body.data.shape,
          body.data.data,
          body.data.author,
          body.data.tags,
          body.data.uploads
        );
        getCouchDB().use(`coursedb-${body.data.courseID}`)
          .insert(payload as Nano.MaybeDocument)
          .then((r) => {
            logger.info(`\t\t\tCouchDB insert result: ${JSON.stringify(r)}`);
            res.json(r);
          })
          .catch((e) => {
            logger.info(`\t\t\tCouchDB insert error: ${JSON.stringify(e)}`);
            res.json(e);
          });
      } else if (body.type === RequestEnum.PACK_COURSE) {
        if (envConfig.NODE_ENV !== 'studio') {
          logger.info(
            `\tPACK_COURSE request received in production mode, but this is not supported!`
          );
          res.status(400);
          res.statusMessage = 'Packing courses is not supported in production mode.';
          res.send();
          return;
        }

        body.response = await packCourse({
          courseId: body.courseId,
          outputPath: body.outputPath,
          couchdbUrl: body.couchdbUrl
        });
        res.json(body.response);
      }
    } else {
      logger.info(`\tREQUEST UNAUTHORIZED!`);
      res.status(401);
      res.statusMessage = 'Unauthorized';
      res.send();
    }
  }

  app.post('/', moderateLimiter, (req: Request, res: Response) => {
    void postHandler(req, res);
  });

  app.get('/version', (_req: Request, res: Response) => {
    res.send(envConfig.VERSION);
  });

  app.get('/', (_req: Request, res: Response) => {
    let status = `Express service is running.\nVersion: ${envConfig.VERSION}\n`;

    getCouchDB().session()
      .then((s) => {
        if (s.ok) {
          status += 'Couchdb is running.\n';
        } else {
          status += 'Couchdb session is NOT ok.\n';
        }
      })
      .catch((e) => {
        status += `Problems in the couch session! ${JSON.stringify(e)}`;
      })
      .finally(() => {
        res.send(status);
      });
  });

  return app;
}

/**
 * Initialize background services and database connections.
 * This should be called after the server starts listening.
 */
export async function initializeServices(config: AppConfig): Promise<void> {
  // Initialize data layer first
  const envConfig = isExpressServerConfig(config)
    ? convertToEnvConfig(config)
    : config;



  await initializeDataLayer({
    type: 'couch',
    options: {
      COUCHDB_PASSWORD: envConfig.COUCHDB_PASSWORD,
      COUCHDB_USERNAME: envConfig.COUCHDB_ADMIN,
      COUCHDB_SERVER_PROTOCOL: envConfig.COUCHDB_PROTOCOL,
      COUCHDB_SERVER_URL: envConfig.COUCHDB_SERVER,
    },
  }).catch((e) => {
    logger.error('Error initializing data layer:', e);
    // In programmatic mode, we shouldn't exit the process, but let the error propagate
    throw e;
  });

  // Apply design documents to _users database for auth flows
  try {
    await applyUsersDesignDocs();
    logger.info('Auth design documents applied successfully');
  } catch (error) {
    logger.error('Error applying auth design documents:', error);
    // Don't throw - auth design docs are nice-to-have, not critical for startup
  }
  try {
    // start the change-listener that does post-processing on user
    // media uploads
    void PostProcess();

    initCourseDBDesignDocInsert().catch((error) => {
      logger.error(`Error in initCourseDBDesignDocInsert background task: ${error}`);
      if (error && typeof error === 'object') {
        logger.error(`Full error details in initCourseDBDesignDocInsert: ${JSON.stringify(error)}`);
      }
    });

    void useOrCreateDB('coursedb-lookup');
    void useOrCreateDB('classdb-lookup');
    try {
      await (
        await useOrCreateDB('coursedb')
      ).insert(
        {
          validate_doc_update: classroomDbDesignDoc,
        } as Nano.MaybeDocument,
        '_design/_auth'
      );
    } catch (e) {
      logger.info(`Error: ${e}`);
    }
  } catch (e) {
    logger.info(`Error: ${JSON.stringify(e)}`);
  }
}
