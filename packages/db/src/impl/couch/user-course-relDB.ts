import {
  ScheduledCard,
  UserCourseSetting,
  UserCourseSettings,
  UsrCrsDataInterface,
} from '@db/core';
import moment, { Moment } from 'moment';
import { getStartAndEndKeys, REVIEW_PREFIX, REVIEW_TIME_FORMAT } from '.';
import { CourseDB } from './courseDB';
import { User } from './userDB';
import { logger } from '../../util/logger';

export class UsrCrsData implements UsrCrsDataInterface {
  private user: User;
  private course: CourseDB;
  private _courseId: string;

  constructor(user: User, courseId: string) {
    this.user = user;
    this.course = new CourseDB(courseId, async () => this.user);
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
    void this.user.updateCourseSettings(this._courseId, updates);
  }

  private async getReviewstoDate(targetDate: Moment) {
    const keys = getStartAndEndKeys(REVIEW_PREFIX);

    const reviews = await this.user.remote().allDocs<ScheduledCard>({
      startkey: keys.startkey,
      endkey: keys.endkey,
      include_docs: true,
    });

    logger.debug(
      `Fetching ${this.user.getUsername()}'s scheduled reviews for course ${this._courseId}.`
    );
    return reviews.rows
      .filter((r) => {
        if (r.id.startsWith(REVIEW_PREFIX)) {
          const date = moment.utc(r.id.substr(REVIEW_PREFIX.length), REVIEW_TIME_FORMAT);
          if (targetDate.isAfter(date)) {
            if (this._courseId === undefined || r.doc!.courseId === this._courseId) {
              return true;
            }
          }
        }
      })
      .map((r) => r.doc!);
  }
}
