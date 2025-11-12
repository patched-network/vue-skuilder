// packages/db/src/impl/static/coursesDB.ts

import { CoursesDBInterface } from '../../core/interfaces';
import { CourseConfig } from '@vue-skuilder/common';
import { StaticCourseManifest } from '../../util/packer/types';
import { logger } from '../../util/logger';

export class StaticCoursesDB implements CoursesDBInterface {
  constructor(
    private manifests: Record<string, StaticCourseManifest>,
    private dependencyNameToCourseId?: Map<string, string>
  ) {}

  async getCourseConfig(courseId: string): Promise<CourseConfig> {
    // Try direct lookup by courseId first
    let manifest = this.manifests[courseId];

    // If not found, try lookup by dependency name (backwards compatibility)
    if (!manifest && this.dependencyNameToCourseId) {
      const mappedCourseId = this.dependencyNameToCourseId.get(courseId);
      if (mappedCourseId) {
        manifest = this.manifests[mappedCourseId];
      }
    }

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
