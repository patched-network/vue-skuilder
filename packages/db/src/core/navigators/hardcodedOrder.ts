import { CourseDBInterface, QualifiedCardID, StudySessionNewItem, StudySessionReviewItem, UserDBInterface } from '..';
import { ContentNavigationStrategyData } from '../types/contentNavigationStrategy';
import { ScheduledCard } from '../types/user';
import { ContentNavigator, WeightedCard } from './index';
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

  /**
   * Get cards in hardcoded order with scores based on position.
   *
   * Earlier cards in the sequence get higher scores.
   * Score formula: 1.0 - (position / totalCards) * 0.5
   * This ensures scores range from 1.0 (first card) to 0.5+ (last card).
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    const activeCardIds = (await this.user.getActiveCards()).map((c: QualifiedCardID) => c.cardID);
    const reviews = await this.getPendingReviews();

    // Filter out already-active cards
    const newCardIds = this.orderedCardIds.filter(
      (cardId) => !activeCardIds.includes(cardId)
    );

    const totalCards = newCardIds.length;

    // Score new cards by position in sequence
    const scoredNew: WeightedCard[] = newCardIds.slice(0, limit).map((cardId, index) => {
      const position = index + 1;
      const score = Math.max(0.5, 1.0 - (index / totalCards) * 0.5);

      return {
        cardId,
        courseId: this.course.getCourseID(),
        score,
        provenance: [
          {
            strategy: 'hardcodedOrder',
            action: 'generated',
            score,
            reason: `Position ${position} of ${totalCards} in fixed sequence, new card`,
          },
        ],
      };
    });

    // Score reviews at 1.0 (highest priority)
    const scoredReviews: WeightedCard[] = reviews.map((r) => ({
      cardId: r.cardID,
      courseId: r.courseID,
      score: 1.0,
      provenance: [
        {
          strategy: 'hardcodedOrder',
          action: 'generated',
          score: 1.0,
          reason: 'Scheduled review, highest priority',
        },
      ],
    }));

    // Combine (reviews already sorted at top due to score=1.0)
    const all = [...scoredReviews, ...scoredNew];
    all.sort((a, b) => b.score - a.score);

    return all.slice(0, limit);
  }
}
