import axios, { AxiosBasicCredentials, AxiosResponse } from 'axios';
import {
  AddCourseDataPayload,
  CourseConfig,
  CreateCourse,
  ServerRequestType,
} from '@vue-skuilder/common';
import { CreateCourseResp } from './client-requests/course-requests.js';

export default class SkldrClient {
  server: string;

  constructor(server: string) {
    this.server = server;
  }

  /**
   * Create a new course.
   */
  async createCourse(
    cfg: CourseConfig,
    auth?: AxiosBasicCredentials
  ): Promise<AxiosResponse<CreateCourseResp>> {
    const request: CreateCourse = {
      type: ServerRequestType.CREATE_COURSE,
      data: cfg,
      user: 'apiClient',
      response: null,
    };

    const resp = await axios.post<CreateCourse, AxiosResponse<CreateCourseResp>>(
      `${this.server}`,
      request,
      {
        auth: auth,
      }
    );

    return resp;
  }

  /**
   * Creates a client to interact with the specified course.
   */
  getCourseClient(id: string): SkldrCourseClient {
    return new SkldrCourseClient(this.server, id);
  }

  /**
   * @returns a list of all courses on the server in `id - name` format.
   */
  async getCourses(): Promise<string[]> {
    const resp = await axios.get(`${this.server}/courses`);
    return resp.data;
  }
  async getVersion(): Promise<string> {
    const resp = await axios.get(`${this.server}/version`);
    return resp.data;
  }
  async getRoles(): Promise<string[]> {
    const resp = await axios.get(`${this.server}/roles`);
    return resp.data;
  }
}

class SkldrCourseClient {
  id: string;
  server: string;

  constructor(server: string, id: string) {
    this.server = server;
    this.id = id;
  }

  addData(data: AddCourseDataPayload): Promise<Express.Response> {
    return axios.post(`${this.server}/${this.id}`, {
      method: 'POST',
      body: data,
    });
  }

  async deleteCourse(auth?: AxiosBasicCredentials): Promise<Express.Response> {
    // [ ] Consider auth / permanence of "destructive" actions
    return axios.delete(`${this.server}/course/${this.id}`, {
      auth,
    });

    // [ ] remove also from the `coursedb-lookup` database (?)
  }

  async getConfig(): Promise<CourseConfig> {
    const resp = await axios.get<void, AxiosResponse<CourseConfig>>(
      `${this.server}/course/${this.id}/config`
    );
    return resp.data;
  }
}
