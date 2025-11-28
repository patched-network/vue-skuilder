import { ScheduledCard } from '../types/user';
import { CourseDBInterface } from '../interfaces/courseDB';
import { UserDBInterface } from '../interfaces/userDB';
import { ContentNavigator, WeightedCard } from './index';
import { CourseElo, toCourseElo } from '@vue-skuilder/common';
import { StudySessionReviewItem, StudySessionNewItem, QualifiedCardID } from '..';

export default class ELONavigator extends ContentNavigator {
  user: UserDBInterface;
  course: CourseDBInterface;

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface
    // The ELO strategy is non-parameterized.
    //
    // It instead relies on existing meta data from the course and user with respect to
    //
    //
    // strategy?: ContentNavigationStrategyData
  ) {
    super();
    this.user = user;
    this.course = course;
  }

  async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    type ratedReview = ScheduledCard & CourseElo;

    const reviews = await this.user.getPendingReviews(this.course.getCourseID()); // todo: this adds a db round trip - should be server side
    const elo = await this.course.getCardEloData(reviews.map((r) => r.cardId));

    const ratedReviews = reviews.map((r, i) => {
      const ratedR: ratedReview = {
        ...r,
        ...elo[i],
      };
      return ratedR;
    });

    ratedReviews.sort((a, b) => {
      return a.global.score - b.global.score;
    });

    return ratedReviews.map((r) => {
      return {
        ...r,
        contentSourceType: 'course',
        contentSourceID: this.course.getCourseID(),
        cardID: r.cardId,
        courseID: r.courseId,
        qualifiedID: `${r.courseId}-${r.cardId}`,
        reviewID: r._id,
        status: 'review',
      };
    });
  }

  async getNewCards(limit: number = 99): Promise<StudySessionNewItem[]> {
    const activeCards = await this.user.getActiveCards();
    return (
      await this.course.getCardsCenteredAtELO(
        { limit: limit, elo: 'user' },
        (c: QualifiedCardID) => {
          if (activeCards.some((ac) => c.cardID === ac.cardID)) {
            return false;
          } else {
            return true;
          }
        }
      )
    ).map((c) => {
      return {
        ...c,
        status: 'new',
      };
    });
  }

  /**
   * Get cards with suitability scores based on ELO distance.
   *
   * Cards closer to user's ELO get higher scores.
   * Score formula: max(0, 1 - distance / 500)
   */
  async getWeightedCards(limit: number): Promise<WeightedCard[]> {
    // Get user's ELO for this course
    const courseReg = await this.user.getCourseRegDoc(this.course.getCourseID());
    const userElo = toCourseElo(courseReg.elo);
    const userGlobalElo = userElo.global.score;

    // Get new cards (existing logic)
    const newCards = await this.getNewCards(limit);

    // Get reviews (existing logic)
    const reviews = await this.getPendingReviews();

    // Get ELO data for all cards in one batch
    const allCardIds = [...newCards.map((c) => c.cardID), ...reviews.map((r) => r.cardID)];
    const cardEloData = await this.course.getCardEloData(allCardIds);

    // Build a map for quick lookup
    const eloMap = new Map<string, number>();
    allCardIds.forEach((id, i) => {
      eloMap.set(id, cardEloData[i]?.global?.score ?? 1000);
    });

    // Score new cards by ELO distance
    const scoredNew: WeightedCard[] = newCards.map((c) => {
      const cardElo = eloMap.get(c.cardID) ?? 1000;
      const distance = Math.abs(cardElo - userGlobalElo);
      const score = Math.max(0, 1 - distance / 500);

      return {
        cardId: c.cardID,
        courseId: c.courseID,
        score,
        source: 'new' as const,
      };
    });

    // Score reviews (for now, score=1.0; future: score by overdueness)
    const scoredReviews: WeightedCard[] = reviews.map((r) => ({
      cardId: r.cardID,
      courseId: r.courseID,
      score: 1.0,
      source: 'review' as const,
    }));

    // Combine and sort by score descending
    const all = [...scoredNew, ...scoredReviews];
    all.sort((a, b) => b.score - a.score);

    return all.slice(0, limit);
  }
}
