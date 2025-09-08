// packages/db/src/impl/static/coursesDB.ts

import { CoursesDBInterface } from '../../core/interfaces';
import { CourseConfig } from '@vue-skuilder/common';
import { StaticCourseManifest } from '../../util/packer/types';
import { logger } from '../../util/logger';

export class StaticCoursesDB implements CoursesDBInterface {
  constructor(private manifests: Record<string, StaticCourseManifest>) {}

  async getCourseConfig(courseId: string): Promise<CourseConfig> {
    const manifest = this.manifests[courseId];
    if (!manifest) {
      logger.warn(`Course manifest for ${courseId} not found`);
      throw new Error(`Course ${courseId} not found`);
    }

    if (manifest.courseConfig) {
      return manifest.courseConfig;
    } else {
      logger.warn(`Course config not found in manifest for course ${courseId}`);
      throw new Error(`Course config not found for course ${courseId}`);
    }
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
