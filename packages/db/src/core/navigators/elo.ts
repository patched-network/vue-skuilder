import { ScheduledCard } from '../types/user';
import { CourseDBInterface } from '../interfaces/courseDB';
import { UserDBInterface } from '../interfaces/userDB';
import { ContentNavigator } from './index';
import { CourseElo } from '@vue-skuilder/common';
import { StudySessionReviewItem, StudySessionNewItem, QualifiedCardID } from '..';
import { StudySessionItem } from '../interfaces/contentSource';

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
}
