import { StudyContentSource } from '../interfaces/contentSource';
import { DocType, SkuilderCourseData } from './types-legacy';
import {
  CourseDBInterface,
  ScheduledCard,
  StudySessionNewItem,
  StudySessionReviewItem,
  UserDBInterface,
} from '..';
import { Navigators } from '../navigators';
import ELONavigator from '../navigators/elo';

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

    switch (implementingClass) {
      case Navigators.ELO:
        return new ELONavigator(user, course);
      default:
        throw new Error(`Unknown implementing class: ${implementingClass}`);
    }
  }

  abstract getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;
  abstract getNewCards(n?: number): Promise<StudySessionNewItem[]>;
}
