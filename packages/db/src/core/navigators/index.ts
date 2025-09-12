import {
  StudyContentSource,
  UserDBInterface,
  CourseDBInterface,
  StudySessionReviewItem,
  StudySessionNewItem,
} from '..';
import { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import { ScheduledCard } from '../types/user';
import { logger } from '../../util/logger';

export enum Navigators {
  ELO = 'elo',
  HARDCODED = 'hardcodedOrder',
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
  static async create(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ): Promise<ContentNavigator> {
    const implementingClass = strategyData.implementingClass;
    let NavigatorImpl;

    // Try different extension variations
    const variations = ['.ts', '.js', ''];

    for (const ext of variations) {
      try {
        const module = await import(`./${implementingClass}${ext}`);
        NavigatorImpl = module.default;
        break; // Break the loop if loading succeeds
      } catch (e) {
        // Continue to next variation if this one fails
        logger.debug(`Failed to load with extension ${ext}:`, e);
      }
    }

    if (!NavigatorImpl) {
      throw new Error(`Could not load navigator implementation for: ${implementingClass}`);
    }

    return new NavigatorImpl(user, course, strategyData);
  }

  abstract getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;
  abstract getNewCards(n?: number): Promise<StudySessionNewItem[]>;
}
