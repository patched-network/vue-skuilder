import { adjustCourseScores, toCourseElo } from '@vue-skuilder/common';
import { DataLayerProvider, UserDBInterface, CourseRegistrationDoc } from '@db/core';
import { StudySessionRecord } from '../SessionController';
import { logger } from '@db/util/logger';

/**
 * Service responsible for ELO rating calculations and updates.
 */
export class EloService {
  private dataLayer: DataLayerProvider;
  private user: UserDBInterface;

  constructor(dataLayer: DataLayerProvider, user: UserDBInterface) {
    this.dataLayer = dataLayer;
    this.user = user;
  }

  /**
   * Updates both user and card ELO ratings based on user performance.
   * @param userScore Score between 0-1 representing user performance
   * @param course_id Course identifier
   * @param card_id Card identifier  
   * @param userCourseRegDoc User's course registration document (will be mutated)
   * @param currentCard Current card session record
   * @param k Optional K-factor for ELO calculation
   */
  public async updateUserAndCardElo(
    userScore: number,
    course_id: string,
    card_id: string,
    userCourseRegDoc: CourseRegistrationDoc,
    currentCard: StudySessionRecord,
    k?: number
  ): Promise<void> {
    if (k) {
      logger.warn(`k value interpretation not currently implemented`);
    }
    const courseDB = this.dataLayer.getCourseDB(currentCard.card.course_id);
    const userElo = toCourseElo(userCourseRegDoc.courses.find((c) => c.courseID === course_id)!.elo);
    const cardElo = (await courseDB.getCardEloData([currentCard.card.card_id]))[0];

    if (cardElo && userElo) {
      const eloUpdate = adjustCourseScores(userElo, cardElo, userScore);
      userCourseRegDoc.courses.find((c) => c.courseID === course_id)!.elo = eloUpdate.userElo;

      const results = await Promise.allSettled([
        this.user.updateUserElo(course_id, eloUpdate.userElo),
        courseDB.updateCardElo(card_id, eloUpdate.cardElo),
      ]);

      // Check the results of each operation
      const userEloStatus = results[0].status === 'fulfilled';
      const cardEloStatus = results[1].status === 'fulfilled';

      if (userEloStatus && cardEloStatus) {
        const user = (results[0] as PromiseFulfilledResult<any>).value;
        const card = (results[1] as PromiseFulfilledResult<any>).value;

        if (user.ok && card && card.ok) {
          logger.info(
            `[EloService] Updated ELOS:
            \tUser: ${JSON.stringify(eloUpdate.userElo)})
            \tCard: ${JSON.stringify(eloUpdate.cardElo)})
            `
          );
        }
      } else {
        // Log which operations succeeded and which failed
        logger.warn(
          `[EloService] Partial ELO update:
          \tUser ELO update: ${userEloStatus ? 'SUCCESS' : 'FAILED'}
          \tCard ELO update: ${cardEloStatus ? 'SUCCESS' : 'FAILED'}`
        );

        if (!userEloStatus && results[0].status === 'rejected') {
          logger.error('[EloService] User ELO update error:', results[0].reason);
        }

        if (!cardEloStatus && results[1].status === 'rejected') {
          logger.error('[EloService] Card ELO update error:', results[1].reason);
        }
      }
    }
  }
}