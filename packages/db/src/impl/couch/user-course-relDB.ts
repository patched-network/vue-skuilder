import {
  ScheduledCard,
  UserCourseSetting,
  UserCourseSettings,
  UsrCrsDataInterface,
} from '@db/core';

import moment, { Moment } from 'moment';

import { UserDBInterface } from '@db/core';
import { logger } from '../../util/logger';

export class UsrCrsData implements UsrCrsDataInterface {
  private user: UserDBInterface;
  private _courseId: string;

  constructor(user: UserDBInterface, courseId: string) {
    this.user = user;
    this._courseId = courseId;
  }

  public async getReviewsForcast(daysCount: number) {
    const time = moment.utc().add(daysCount, 'days');
    return this.getReviewstoDate(time);
  }

  public async getPendingReviews() {
    const now = moment.utc();
    return this.getReviewstoDate(now);
  }

  public async getScheduledReviewCount(): Promise<number> {
    return (await this.getPendingReviews()).length;
  }

  public async getCourseSettings(): Promise<UserCourseSettings> {
    const regDoc = await this.user.getCourseRegistrationsDoc();
    const crsDoc = regDoc.courses.find((c) => c.courseID === this._courseId);

    if (crsDoc && crsDoc.settings) {
      return crsDoc.settings;
    } else {
      logger.warn(`no settings found during lookup on course ${this._courseId}`);
      return {};
    }
  }
  public updateCourseSettings(updates: UserCourseSetting[]): void {
    // TODO: Add updateCourseSettings method to UserDBInterface
    // For now, we'll need to cast to access the concrete implementation
    if ('updateCourseSettings' in this.user) {
      void (this.user as any).updateCourseSettings(this._courseId, updates);
    }
  }

  private async getReviewstoDate(targetDate: Moment) {
    // Use the interface method instead of direct database access
    const allReviews = await this.user.getPendingReviews(this._courseId);

    logger.debug(
      `Fetching ${this.user.getUsername()}'s scheduled reviews for course ${this._courseId}.`
    );

    return allReviews.filter((review: ScheduledCard) => {
      const reviewTime = moment.utc(review.reviewTime);
      return targetDate.isAfter(reviewTime);
    });
  }
}
