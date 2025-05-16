import {
  StudyContentSource,
  UserDBInterface,
  CourseDBInterface,
  StudySessionReviewItem,
  StudySessionNewItem,
} from '..';
import { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import { ScheduledCard } from '../types/user';

export enum Navigators {
  ELO = 'elo',
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
    const NavigatorImpl = require(`./${implementingClass}.ts`).default;
    return new NavigatorImpl(user, course, strategyData);
  }

  abstract getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;
  abstract getNewCards(n?: number): Promise<StudySessionNewItem[]>;
}
