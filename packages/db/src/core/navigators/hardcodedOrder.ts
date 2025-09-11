import { CourseDBInterface, QualifiedCardID, StudySessionNewItem, StudySessionReviewItem, UserDBInterface } from '..';
import { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import { ScheduledCard } from '../types/user';
import { ContentNavigator } from './index';
import { logger } from '../../util/logger';

export default class HardcodedOrderNavigator extends ContentNavigator {
  private orderedCardIds: string[] = [];
  private user: UserDBInterface;
  private course: CourseDBInterface;

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ) {
    super();
    this.user = user;
    this.course = course;

    if (strategyData.serializedData) {
      try {
        this.orderedCardIds = JSON.parse(strategyData.serializedData);
      } catch (e) {
        logger.error('Failed to parse serializedData for HardcodedOrderNavigator', e);
      }
    }
  }

  async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    const reviews = await this.user.getPendingReviews(this.course.getCourseID());
    return reviews.map((r) => {
      return {
        ...r,
        contentSourceType: 'course',
        contentSourceID: this.course.getCourseID(),
        cardID: r.cardId,
        courseID: r.courseId,
        reviewID: r._id,
        status: 'review',
      };
    });
  }

  async getNewCards(limit: number = 99): Promise<StudySessionNewItem[]> {
    const activeCardIds = (await this.user.getActiveCards()).map((c: QualifiedCardID) => c.cardID);

    const newCardIds = this.orderedCardIds.filter(
      (cardId) => !activeCardIds.includes(cardId)
    );

    const cardsToReturn = newCardIds.slice(0, limit);

    return cardsToReturn.map((cardId) => {
      return {
        cardID: cardId,
        courseID: this.course.getCourseID(),
        contentSourceType: 'course',
        contentSourceID: this.course.getCourseID(),
        status: 'new',
      };
    });
  }
}
