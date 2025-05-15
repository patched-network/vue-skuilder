import { StudyContentSource } from '../interfaces/contentSource';
import { DocType, SkuilderCourseData } from './types-legacy';
import {
  CourseDBInterface,
  ScheduledCard,
  StudySessionNewItem,
  StudySessionReviewItem,
  UserDBInterface,
} from '..';

/**
 *
 */
export interface ContentNavigationStrategyData extends SkuilderCourseData {
  id: string;
  docType: DocType.NAVIGATION_STRATEGY;
  name: string;
  description: string;
  /**
   The name of the class that implements the navigation strategy at runtime.
   */
  implementingClass: string;

  /**
   A representation of the strategy's parameterization - to be deserialized
   by the implementing class's constructor at runtime.
  */
  serializedData: string;
}

/**
 * A content-navigator provides runtime steering of study sessions.
 */
export abstract class ContentNavigator implements StudyContentSource {
  /**
   *
   * @param user
   * @param strategyData
   * @returns the runtime object used to steer a study session.
   */
  static create(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ): ContentNavigator {
    const implementingClass = strategyData.implementingClass;
    const NavigatorClass = require(`./${implementingClass}`).default; // todo: determine better relative location here
    return new NavigatorClass(user, course, strategyData);
  }

  abstract getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;
  abstract getNewCards(n?: number): Promise<StudySessionNewItem[]>;
}
