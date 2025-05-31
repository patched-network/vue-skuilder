import hashids from 'hashids';
import {
  ClassroomConfig,
  CreateClassroom,
  JoinClassroom,
  LeaveClassroom,
  Status,
} from '@vue-skuilder/common';
import { classroomDbDesignDoc } from '../design-docs.js';
import CouchDB, {
  SecurityObject,
  docCount,
  useOrCreateDB,
} from '../couchdb/index.js';
import AsyncProcessQueue, { Result } from '../utils/processQueue.js';
import logger from '../logger.js';

export const CLASSROOM_DB_LOOKUP = 'classdb-lookup';
const CLASSROOM_CONFIG = 'ClassroomConfig';

interface lookupData {
  num: number;
  uuid: string;
}

// async function deleteClassroom(_classroom_id: string) {}

async function getClassID(joinCode: string) {
  try {
    const doc = await (await useOrCreateDB(CLASSROOM_DB_LOOKUP)).get(joinCode);
    return (doc as lookupData).uuid;
  } catch (e) {
    return '';
  }
}

async function getClassroomConfig(id: string): Promise<ClassroomConfig> {
  return (await useOrCreateDB(getClassDBNames(id).studentDB)).get(
    CLASSROOM_CONFIG
  ) as unknown as ClassroomConfig;
}
async function writeClassroomConfig(config: ClassroomConfig, classID: string) {
  logger.info(`Writing config for class: ${classID}`);
  const dbNames = getClassDBNames(classID);
  const studentDB = await useOrCreateDB(dbNames.studentDB);
  const teacherDB = await useOrCreateDB(dbNames.teacherDB);

  return Promise.all([
    studentDB
      .get(CLASSROOM_CONFIG)
      .then((doc) => {
        return studentDB.insert({
          _id: CLASSROOM_CONFIG,
          _rev: doc._rev,
          ...config,
        });
      })
      .catch((_err) => {
        return studentDB.insert({
          _id: CLASSROOM_CONFIG,
          ...config,
        });
      }),
    teacherDB
      .get(CLASSROOM_CONFIG)
      .then((doc) => {
        return teacherDB.insert({
          _id: CLASSROOM_CONFIG,
          _rev: doc._rev,
          ...config,
        });
      })
      .catch((_err) => {
        return teacherDB.insert({
          _id: CLASSROOM_CONFIG,
          ...config,
        });
      }),
  ]);
}

function getClassDBNames(classId: string): {
  studentDB: string;
  teacherDB: string;
} {
  return {
    studentDB: `classdb-student-${classId}`,
    teacherDB: `classdb-teacher-${classId}`,
  };
}

async function createClassroom(config: ClassroomConfig) {
  logger.info(`CreateClass Request:
    ${JSON.stringify(config)}`);

  const num = (await docCount(CLASSROOM_DB_LOOKUP)) + 1; //
  const uuid = (await CouchDB.uuids(1)).uuids[0];
  const hasher = new hashids('', 6, 'abcdefghijklmnopqrstuvwxyz123456789');
  const studentDbName = `classdb-student-${uuid}`;
  const teacherDbName = `classdb-teacher-${uuid}`;
  config.joinCode = hasher.encode(num);

  const security: SecurityObject = {
    // _id: '_security',
    admins: {
      names: [],
      roles: [],
    },
    members: {
      names: config.teachers,
      roles: [],
    },
  };

  const [studentdb, teacherdb, lookup] = await Promise.all([
    useOrCreateDB(studentDbName),
    useOrCreateDB(teacherDbName),
    useOrCreateDB('classdb-lookup'),
  ]);
  await Promise.all([
    studentdb.insert(
      {
        validate_doc_update: classroomDbDesignDoc,
      } as Nano.MaybeDocument,
      '_design/_auth'
    ),
    // studentdb.insert(security, '_security'),
    teacherdb.insert(security, '_security'),
    lookup.insert(
      {
        num,
        uuid,
      } as Nano.MaybeDocument,
      config.joinCode
    ),
    writeClassroomConfig(config, uuid),
  ]);

  const res: Result = {
    ok: true,
    status: 'ok',
  };
  const ret = {
    joincode: config.joinCode,
    uuid: uuid,
    ...res,
  };

  logger.info(JSON.stringify(ret));

  return ret;
}

async function leaveClassroom(
  req: LeaveClassroom['data'] & { username: string }
) {
  const cfg: ClassroomConfig = await getClassroomConfig(req.classID);
  if (cfg) {
    const index = cfg.students.indexOf(req.username);
    if (index !== -1) {
      cfg.students.splice(index, 1);
    }

    await writeClassroomConfig(cfg, req.classID);

    return {
      status: Status.ok,
      ok: true,
    };
  } else {
    return {
      status: Status.error,
      ok: false,
      errorText: 'Course with this ID not found.',
    };
  }
}

async function joinClassroom(req: JoinClassroom['data']) {
  const classID = await getClassID(req.joinCode);
  if (classID) {
    const classDBNames = getClassDBNames(classID);

    void (await useOrCreateDB(classDBNames.studentDB)).get('ClassroomConfig');

    logger.info(`joinClassroom running...
        \tRequest: ${JSON.stringify(req)}`);

    const cfg: ClassroomConfig = await getClassroomConfig(classID);

    if (req.registerAs === 'student') {
      if (cfg.students.indexOf(req.user) === -1) {
        cfg.students.push(req.user);
      }
    }

    await writeClassroomConfig(cfg, classID);

    const res: JoinClassroom['response'] = {
      ok: true,
      status: Status.ok,
      id_course: classID,
      course_name: cfg.name,
    };
    return res;
  } else {
    return {
      ok: false,
      status: Status.error,
      id_course: '',
      course_name: '',
      errorText: 'No course found with this joincode!',
    };
  }
}

export const ClassroomLeaveQueue = new AsyncProcessQueue<
  // @ts-expect-error Type intersection with username field not properly recognized by AsyncProcessQueue generic
  LeaveClassroom['data'] & { username: string },
  LeaveClassroom['response']
>(leaveClassroom);

export const ClassroomJoinQueue = new AsyncProcessQueue<
  // @ts-expect-error JoinClassroom data type not fully compatible with AsyncProcessQueue generic constraints
  JoinClassroom['data'],
  JoinClassroom['response']
>(joinClassroom);

export const ClassroomCreationQueue = new AsyncProcessQueue<
  // @ts-expect-error CreateClassroom data type not fully compatible with AsyncProcessQueue generic constraints
  CreateClassroom['data'],
  CreateClassroom['response']
>(createClassroom);
