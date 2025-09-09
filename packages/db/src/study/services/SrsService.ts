import moment from 'moment';
import { CardHistory, CardRecord, UserDBInterface } from '@db/core';
import { isReview, StudySessionItem } from '@db/impl/couch';
import { newInterval } from '../SpacedRepetition';
import { logger } from '@db/util/logger';

/**
 * Service responsible for Spaced Repetition System (SRS) scheduling logic.
 */
export class SrsService {
  private user: UserDBInterface;

  constructor(user: UserDBInterface) {
    this.user = user;
  }

  /**
   * Calculates the next review time for a card based on its history and
   * schedules it in the user's database.
   * @param history The full history of the card.
   * @param item The study session item, used to determine if a previous review needs to be cleared.
   */
  public async scheduleReview(
    history: CardHistory<CardRecord>,
    item: StudySessionItem
  ): Promise<void> {
    const nextInterval = newInterval(this.user, history);
    const nextReviewTime = moment.utc().add(nextInterval, 'seconds');

    if (isReview(item)) {
      logger.info(`[SrsService] Removing previously scheduled review for: ${item.cardID}`);
      void this.user.removeScheduledCardReview(item.reviewID);
    }

    void this.user.scheduleCardReview({
      user: this.user.getUsername(),
      course_id: history.courseID,
      card_id: history.cardID,
      time: nextReviewTime,
      scheduledFor: item.contentSourceType,
      schedulingAgentId: item.contentSourceID,
    });
  }
}
