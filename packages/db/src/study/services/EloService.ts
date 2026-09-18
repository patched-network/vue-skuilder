import {
  adjustCourseScores,
  adjustCourseScoresPerTag,
  toCourseElo,
  TaggedPerformance,
} from '@vue-skuilder/common';
import {
  DataLayerProvider,
  UserDBInterface,
  CourseRegistrationDoc,
  SessionEloEvent,
} from '@db/core';
import { StudySessionRecord } from '../SessionController';
import { logger } from '@db/util/logger';
import { recordTagPresentations } from './tagRecent';

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
   * @returns The captured before→after exchange for session logging, or null
   *   if no update was applied (missing registration / unreadable ELO).
   */
  public async updateUserAndCardElo(
    userScore: number,
    course_id: string,
    card_id: string,
    userCourseRegDoc: CourseRegistrationDoc,
    currentCard: StudySessionRecord,
    k?: number
  ): Promise<SessionEloEvent | null> {
    if (k) {
      logger.warn(`k value interpretation not currently implemented`);
    }
    const courseDB = this.dataLayer.getCourseDB(currentCard.card.course_id);
    const courseReg = userCourseRegDoc.courses.find((c) => c.courseID === course_id);
    if (!courseReg) {
      logger.error(
        `[EloService] No registration for course ${course_id} on user's registration doc — ` +
          `skipping ELO update for card ${card_id}. (Is the user registered for this course?)`
      );
      return null;
    }
    const userElo = toCourseElo(courseReg.elo);
    const cardElo = (await courseDB.getCardEloData([currentCard.card.card_id]))[0];

    if (cardElo && userElo) {
      // Capture before-scores as numbers up front: adjustCourseScores mutates
      // userElo/cardElo in place (and returns the same refs). This path grades
      // every tag already present on the card with the single global score.
      const beforeUserGlobal = userElo.global.score;
      const beforeCardGlobal = cardElo.global.score;
      const cardTagKeys = Object.keys(cardElo.tags);
      const beforeUserTag: Record<string, number> = {};
      for (const tag of cardTagKeys) {
        beforeUserTag[tag] = userElo.tags[tag]?.score ?? userElo.global.score;
      }

      const eloUpdate = adjustCourseScores(userElo, cardElo, userScore);
      courseReg.elo = eloUpdate.userElo;

      const tags: NonNullable<SessionEloEvent['tags']> = {};
      for (const tag of cardTagKeys) {
        tags[tag] = {
          before: beforeUserTag[tag],
          after: eloUpdate.userElo.tags[tag].score,
          score: userScore,
        };
      }
      const event: SessionEloEvent = {
        cardId: card_id,
        at: new Date().toISOString(),
        userScore,
        global: { before: beforeUserGlobal, after: eloUpdate.userElo.global.score },
        card: { before: beforeCardGlobal, after: eloUpdate.cardElo.global.score },
        ...(cardTagKeys.length ? { tags } : {}),
      };

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

      return event;
    }

    return null;
  }

  /**
   * Updates both user and card ELO ratings with per-tag granularity.
   * Tags in taggedPerformance but not on card will be created dynamically.
   *
   * @param taggedPerformance Performance object with _global and per-tag scores
   * @param course_id Course identifier
   * @param card_id Card identifier
   * @param userCourseRegDoc User's course registration document (will be mutated)
   * @param currentCard Current card session record
   */
  public async updateUserAndCardEloPerTag(
    taggedPerformance: TaggedPerformance,
    course_id: string,
    card_id: string,
    userCourseRegDoc: CourseRegistrationDoc,
    currentCard: StudySessionRecord
  ): Promise<SessionEloEvent | null> {
    const courseDB = this.dataLayer.getCourseDB(currentCard.card.course_id);
    const courseReg = userCourseRegDoc.courses.find((c) => c.courseID === course_id);
    if (!courseReg) {
      logger.error(
        `[EloService] No registration for course ${course_id} on user's registration doc — ` +
          `skipping per-tag ELO update for card ${card_id}. (Is the user registered for this course?)`
      );
      return null;
    }
    const userElo = toCourseElo(courseReg.elo);

    const [cardEloResults, cardTagsMap] = await Promise.all([
      courseDB.getCardEloData([currentCard.card.card_id]),
      courseDB.getAppliedTagsBatch([card_id]),
    ]);
    const cardElo = cardEloResults[0];

    // Enrich TaggedPerformance with card-level tags not explicitly graded by
    // the question's evaluate(). Category tags (concept:*, ui:*, etc.) are not
    // emitted by individual question types; applying the global score as a proxy
    // keeps hierarchy filter ELO thresholds functional without overriding any
    // fine-grained per-GPC scores the question already provided.
    const cardTags = cardTagsMap.get(card_id) ?? [];
    const enriched: TaggedPerformance = { ...taggedPerformance };
    const globalScore = taggedPerformance._global;
    for (const tag of cardTags) {
      if (!(tag in enriched)) {
        enriched[tag] = globalScore;
      }
    }

    if (cardElo && userElo) {
      // Capture before-scores up front — adjustCourseScoresPerTag mutates the
      // ELO objects in place. Every tag in `enriched` (except _global) is
      // touched; count-only tags (null score) increment count without moving
      // ELO and are recorded with score: null.
      const beforeUserGlobal = userElo.global.score;
      const beforeCardGlobal = cardElo.global.score;
      const touchedTags = Object.keys(enriched).filter((key) => key !== '_global');
      const beforeUserTag: Record<string, number> = {};
      for (const tag of touchedTags) {
        beforeUserTag[tag] = userElo.tags[tag]?.score ?? userElo.global.score;
      }

      const eloUpdate = adjustCourseScoresPerTag(userElo, cardElo, enriched);
      const at = new Date().toISOString();

      // Mastery signal: one ring-buffer entry per scored tag per presentation.
      // Retries (priorAttemps > 0 on the current record) add nothing — that
      // includes the dismiss-failed penalty, which lands here on a retry.
      // Only the question's own graded tags count, not the card-level tags
      // enriched with the global score above.
      const recorded = recordTagPresentations(
        eloUpdate.userElo,
        taggedPerformance,
        currentCard.records,
        card_id,
        at
      );
      if (recorded.length) {
        logger.info(`[EloService] recent-presentation entries for ${card_id}: [${recorded.join(', ')}]`);
      }

      courseReg.elo = eloUpdate.userElo;

      const tags: NonNullable<SessionEloEvent['tags']> = {};
      for (const tag of touchedTags) {
        const score = enriched[tag];
        // Count-only exposure tags (null score) get a -1 sentinel score, not a
        // real ELO move — record before===after so a naive after-before reads 0.
        const after =
          score === null ? beforeUserTag[tag] : eloUpdate.userElo.tags[tag]?.score ?? beforeUserTag[tag];
        tags[tag] = { before: beforeUserTag[tag], after, score };
      }
      const event: SessionEloEvent = {
        cardId: card_id,
        at,
        userScore: globalScore,
        global: { before: beforeUserGlobal, after: eloUpdate.userElo.global.score },
        card: { before: beforeCardGlobal, after: eloUpdate.cardElo.global.score },
        ...(touchedTags.length ? { tags } : {}),
      };

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
          const tagCount = Object.keys(enriched).length - 1; // exclude _global
          logger.info(
            `[EloService] Updated ELOS (per-tag, ${tagCount} tags):
            \tUser: ${JSON.stringify(eloUpdate.userElo)})
            \tCard: ${JSON.stringify(eloUpdate.cardElo)})
            `
          );
        }
      } else {
        // Log which operations succeeded and which failed
        logger.warn(
          `[EloService] Partial ELO update (per-tag):
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

      return event;
    }

    return null;
  }
}
