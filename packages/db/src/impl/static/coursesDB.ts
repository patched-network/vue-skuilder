// packages/db/src/impl/static/coursesDB.ts

import { CoursesDBInterface } from '../../core/interfaces';
import { CourseConfig } from '@vue-skuilder/common';
import { StaticCourseManifest } from '../../util/packer/types';
import { logger } from '../../util/logger';

export class StaticCoursesDB implements CoursesDBInterface {
  constructor(private manifests: Record<string, StaticCourseManifest>) {}

  async getCourseConfig(courseId: string): Promise<CourseConfig> {
    if (!this.manifests[courseId]) {
      // throw new Error(`Course ${courseId} not found`);
      logger.warn(`Course ${courseId} not found`);
      return {} as CourseConfig; // Return empty config if course not found
    }

    // Would need to fetch the course config from static files
    return {} as CourseConfig;
  }

  async getCourseList(): Promise<CourseConfig[]> {
    // Return configs for all available courses
    return Object.keys(this.manifests).map(
      (courseId) =>
        ({
          courseID: courseId,
          name: this.manifests[courseId].courseName,
          // ... other config fields
        }) as CourseConfig
    );
  }

  async disambiguateCourse(_courseId: string, _disambiguator: string): Promise<void> {
    logger.warn('Cannot disambiguate courses in static mode');
  }
}
