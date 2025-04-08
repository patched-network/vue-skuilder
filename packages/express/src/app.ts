import {
  ServerRequestType as RequestEnum,
  ServerRequest,
  prepareNote55,
} from '@vue-skuilder/common';
import { CourseLookup } from '@vue-skuilder/db';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import type { Request, Response } from 'express';
import express from 'express';
import * as fileSystem from 'fs';
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
import { requestIsAuthenticated } from './couchdb/authentication.js';
import CouchDB, {
  useOrCreateCourseDB,
  useOrCreateDB,
} from './couchdb/index.js';
import logger from './logger.js';
import logsRouter from './routes/logs.js';
import ENV from './utils/env.js';

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

logger.info(`Express app running version: ${ENV.VERSION}`);

const port = 3000;
export const classroomDbDesignDoc = fileSystem.readFileSync(
  './assets/classroomDesignDoc.js',
  'utf-8'
);
export const courseDBDesignDoc = fileSystem.readFileSync(
  './assets/get-tagsDesignDoc.json',
  'utf-8'
);
const app = express();

app.use(cookieParser());
app.use(express.json());
app.use(
  cors({
    credentials: true,
    origin: true,
  })
);
app.use(
  morgan('combined', {
    stream: { write: (message: string) => logger.info(message.trim()) },
  })
);
app.use('/logs', logsRouter);

export interface VueClientRequest extends express.Request {
  body: ServerRequest;
}

app.get('/courses', async (req: Request, res: Response) => {
  try {
    const courses = await CourseLookup.allCourses();
    res.send(courses.map((c) => `${c._id} - ${c.name}`));
  } catch (error) {
    logger.error('Error fetching courses:', error);
    res.status(500).send('Failed to fetch courses');
  }
});

app.get('/course/:courseID/config', async (req: Request, res: Response) => {
  const courseDB = await useOrCreateCourseDB(req.params.courseID);
  const cfg = await courseDB.get('CourseConfig'); // [ ] pull courseConfig docName into global const

  res.json(cfg);
});

app.delete('/course/:courseID', async (req: Request, res: Response) => {
  logger.info(`Delete request made on course ${req.params.courseID}...`);
  const auth = await requestIsAuthenticated(req);
  if (auth) {
    logger.info(`\tAuthenticated delete request made...`);
    const dbResp = await CouchDB.db.destroy(`coursedb-${req.params.courseID}`);
    if (!dbResp.ok) {
      res.json({ success: false, error: dbResp });
      return;
    }
    const delResp = await CourseLookup.delete(req.params.courseID);

    if (delResp.ok) {
      res.json({ success: true });
    } else {
      res.json({ success: false, error: delResp });
    }
  } else {
    res.json({ success: false, error: 'Not authenticated' });
  }
});

async function postHandler(req: VueClientRequest, res: express.Response) {
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
      CouchDB.use(`coursedb-${body.data.courseID}`)
        .insert(payload as Nano.MaybeDocument)
        .then((r) => {
          logger.info(`\t\t\tCouchDB insert result: ${JSON.stringify(r)}`);
          res.json(r);
        })
        .catch((e) => {
          logger.info(`\t\t\tCouchDB insert error: ${JSON.stringify(e)}`);
          res.json(e);
        });
    }
  } else {
    logger.info(`\tREQUEST UNAUTHORIZED!`);
    res.status(401);
    res.statusMessage = 'Unauthorized';
    res.send();
  }
}

app.post('/', (req: Request, res: Response) => {
  postHandler(req, res);
});

app.get('/version', (req: Request, res: Response) => {
  res.send(ENV.VERSION);
});

app.get('/', (req: Request, res: Response) => {
  let status = `Express service is running.\nVersion: ${ENV.VERSION}\n`;

  CouchDB.session()
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
let listening = false;

app.listen(port, () => {
  listening = true;
  logger.info(`Express app listening on port ${port}!`);
});

init();

async function init(): void {
  while (!listening) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  try {
    // start the change-listener that does post-processing on user
    // media uploads
    PostProcess();

    initCourseDBDesignDocInsert();

    useOrCreateDB('classdb-lookup');
    try {
      (await useOrCreateDB('coursedb')).insert(
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
