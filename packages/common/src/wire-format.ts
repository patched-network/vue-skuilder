import { DataShape } from './interfaces/DataShape.js';

export enum Status {
  awaitingResponse = 'awaiting',
  ok = 'ok',
  warning = 'warning',
  error = 'error',
}

export interface IServerResponse {
  errorText?: string;
  status: Status;
  ok: boolean;
}

export interface IServerRequest {
  type: ServerRequestType;
  user: string;
  response: IServerResponse | null;
  /**
   * milliseconds to wait for a request to complete before timing out
   */
  timeout?: number;
}

export interface CreateClassroom extends IServerRequest {
  type: ServerRequestType.CREATE_CLASSROOM;
  data: ClassroomConfig;
  response: {
    status: Status;
    ok: boolean;
    joincode: string;
    uuid: string;
  } | null;
}
export interface DeleteClassroom extends IServerRequest {
  type: ServerRequestType.DELETE_CLASSROOM;
  classID: string;
}
export interface JoinClassroom extends IServerRequest {
  type: ServerRequestType.JOIN_CLASSROOM;
  user: string;
  data: {
    joinCode: string;
    registerAs: 'student' | 'teacher' | 'aide' | 'admin';
    user: string;
  };
  response: {
    errorText?: string;
    status: Status;
    ok: boolean;
    id_course: string;
    course_name: string;
  } | null;
}
export interface LeaveClassroom extends IServerRequest {
  type: ServerRequestType.LEAVE_CLASSROOM;
  data: {
    classID: string;
  };
}

type NamespacedDatashape = string; // ${course}.datashape.${datashape}

export interface DataShape55 {
  // [ ] rename this to something else - disambiguate from DataShape in base-course
  name: NamespacedDatashape;
  questionTypes: PouchDB.Core.DocumentId[];
  serializedZodSchema?: string;
}

type NamespacedQuestion = string; // ${course}.question.${question}
export interface QuestionType55 {
  name: NamespacedQuestion;
  viewList: string[];
  dataShapeList: string[];
}

export interface ClassroomConfig {
  students: string[];
  teachers: string[];
  name: string;
  birthYear?: number;
  classMeetingSchedule: string;
  peerAssist: boolean;
  joinCode: string;
}

/**
 * metadata about a defined course
 *
 * Note: `courseID` is generated server-side. It is not present on
 * new courses at the time of writing, client-side, but always
 * present (!) when a CourseConfig is retrieved from the database
 */
export interface CourseConfig {
  courseID?: string;
  name: string;
  description: string;
  public: boolean;
  deleted: boolean;
  creator: string;
  admins: string[];
  moderators: string[];
  dataShapes: DataShape55[];
  questionTypes: QuestionType55[];
  disambiguator?: string;
}

export interface CreateCourse extends IServerRequest {
  type: ServerRequestType.CREATE_COURSE;
  data: CourseConfig;
  response: {
    status: Status;
    ok: boolean;
    courseID: string;
  } | null;
}
export interface DeleteCourse extends IServerRequest {
  type: ServerRequestType.DELETE_COURSE;
  courseID: string;
}

export interface AddCourseDataPayload {
  courseID: string;
  codeCourse: string;
  shape: DataShape;
  data: unknown;
  author: string;
  tags: string[];
  uploads?: { [x: string]: PouchDB.Core.FullAttachment };
}

export interface AddCourseData extends IServerRequest {
  type: ServerRequestType.ADD_COURSE_DATA;
  data: AddCourseDataPayload;
  response: {
    status: Status;
    ok: boolean;
  };
}

export interface PackCourse extends IServerRequest {
  type: ServerRequestType.PACK_COURSE;
  courseId: string;
  outputPath?: string;
  couchdbUrl?: string; // Optional full CouchDB connection URL for studio mode
  response: {
    status: Status;
    ok: boolean;
    errorText?: string;
    packedFiles?: string[];
    outputPath?: string;
    totalFiles?: number;
    duration?: number;
  } | null;
}

export type ServerRequest =
  | CreateClassroom
  | DeleteClassroom
  | JoinClassroom
  | LeaveClassroom
  | CreateCourse
  | DeleteCourse
  | AddCourseData
  | PackCourse;

export enum ServerRequestType {
  CREATE_CLASSROOM = 'CREATE_CLASSROOM',
  DELETE_CLASSROOM = 'DELETE_CLASSROOM',
  JOIN_CLASSROOM = 'JOIN_CLASSROOM',
  LEAVE_CLASSROOM = 'LEAVE_CLASSROOM',
  CREATE_COURSE = 'CREATE_COURSE',
  DELETE_COURSE = 'DELETE_COURSE',
  ADD_COURSE_DATA = 'ADD_COURSE_DATA',
  PACK_COURSE = 'PACK_COURSE',
}
