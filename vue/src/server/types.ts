import { Status } from '@/enums/Status';

export interface IServerRequest {
  type: ServerRequestType;
  user: string;
  response: {
    status: Status
  } | null;
}

export interface CreateClassroom extends IServerRequest {
  type: ServerRequestType.CREATE_CLASSROOM;
  className: string;
  response: {
    status: Status;
    joincode: string;
    uuid: string;
  } | null;
}
export interface DeleteClassroom extends IServerRequest {
  type: ServerRequestType.DELETE_CLASSROOM;
  classID: string;
}

export interface CourseConfig {
  _id?: string;
  name: string;
  description: string;
  public: boolean;
  deleted: boolean;
  creator: string;
  admins: string[];
  moderators: string[];
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

export type ServerRequest =
  CreateClassroom |
  DeleteClassroom |
  CreateCourse |
  DeleteCourse;

export enum ServerRequestType {
  CREATE_CLASSROOM = 'CREATE_CLASSROOM',
  DELETE_CLASSROOM = 'DELETE_CLASSROOM',
  CREATE_COURSE = 'CREATE_COURSE',
  DELETE_COURSE = 'DELETE_COURSE'
}
