import {
  CardHistory,
  CardRecord,
  CourseRegistrationDoc,
  isQuestionRecord,
  QuestionRecord,
  StudySessionItem,
} from '@db/core';
import { logger } from '@db/util/logger';
import { ResponseResult, StudySessionRecord } from '../SessionController';
import { EloService } from './EloService';
import { SrsService } from './SrsService';
import { Performance, isTaggedPerformance, TaggedPerformance } from '@vue-skuilder/common';

/**
 * Parsed performance data for ELO updates.
 */
interface ParsedPerformance {
  /** Global score for SRS and global ELO [0, 1] */
  globalScore: number;
  /** Per-tag scores, or null if using simple numeric performance */
  taggedPerformance: TaggedPerformance | null;
}

/**
 * Service responsible for orchestrating the complete response processing workflow.
 * Coordinates SRS scheduling and ELO updates for user card interactions.
 */
export class ResponseProcessor {
  private srsService: SrsService;
  private eloService: EloService;

  constructor(srsService: SrsService, eloService: EloService) {
    this.srsService = srsService;
    this.eloService = eloService;
  }

  /**
   * Parses performance data into global score and optional per-tag scores.
   *
   * @param performance - Numeric or structured performance from QuestionRecord
   * @returns Parsed performance with global score and optional tag scores
   */
  private parsePerformance(performance: Performance): ParsedPerformance {
    if (typeof performance === 'number') {
      // Simple numeric performance - backward compatible
      return {
        globalScore: performance,
        taggedPerformance: null,
      };
    }

    // Structured TaggedPerformance with _global and per-tag scores
    if (isTaggedPerformance(performance)) {
      return {
        globalScore: performance._global,
        taggedPerformance: performance,
      };
    }

    // Fallback for unexpected structure - treat as neutral
    logger.warn('[ResponseProcessor] Unexpected performance structure, using neutral score', {
      performance,
    });
    return {
      globalScore: 0.5,
      taggedPerformance: null,
    };
  }

  /**
   * Processes a user's response to a card, handling SRS scheduling and ELO updates.
   * @param cardRecord User's response record
   * @param cardHistory Promise resolving to the card's history
   * @param studySessionItem Current study session item
   * @param courseRegistrationDoc User's course registration (for ELO updates)
   * @param currentCard Current study session record
   * @param courseId Course identifier
   * @param cardId Card identifier
   * @param maxAttemptsPerView Maximum attempts allowed per view
   * @param maxSessionViews Maximum session views for this card
   * @param sessionViews Current number of session views
   * @returns ResponseResult with navigation and UI instructions
   */
  public async processResponse(
    cardRecord: CardRecord,
    cardHistory: Promise<CardHistory<CardRecord>>,
    studySessionItem: StudySessionItem,
    courseRegistrationDoc: CourseRegistrationDoc,
    currentCard: StudySessionRecord,
    courseId: string,
    cardId: string,
    maxAttemptsPerView: number,
    maxSessionViews: number,
    sessionViews: number
  ): Promise<ResponseResult> {
    // Handle non-question records (simple dismiss)
    if (!isQuestionRecord(cardRecord)) {
      return {
        nextCardAction: 'dismiss-success',
        shouldLoadNextCard: true,
        isCorrect: true, // non-question records are considered "correct"
        shouldClearFeedbackShadow: true,
      };
    }

    try {
      const history = await cardHistory;

      let result: ResponseResult;

      // Handle correct responses
      if (cardRecord.isCorrect) {
        result = this.processCorrectResponse(
          cardRecord,
          history,
          studySessionItem,
          courseRegistrationDoc,
          currentCard,
          courseId,
          cardId
        );
      } else {
        // Handle incorrect responses
        result = this.processIncorrectResponse(
          cardRecord,
          history,
          courseRegistrationDoc,
          currentCard,
          courseId,
          cardId,
          maxAttemptsPerView,
          maxSessionViews,
          sessionViews
        );
      }

      // Apply deferred advancement: record is logged and ELO updated above,
      // but we suppress navigation so the view retains control of the UI
      // timeline. StudySession will stash the nextCardAction and wait for
      // a `ready-to-advance` event from the view.
      if (cardRecord.deferAdvance && result.shouldLoadNextCard) {
        logger.info(
          '[ResponseProcessor] deferAdvance requested — suppressing navigation, action stashed:',
          { nextCardAction: result.nextCardAction }
        );
        result = {
          ...result,
          shouldLoadNextCard: false,
          deferred: true,
        };
      }

      return result;
    } catch (e: unknown) {
      logger.error('[ResponseProcessor] Failed to load card history', { e, cardId });
      throw e;
    }
  }

  /**
   * Handles processing for correct responses: SRS scheduling and ELO updates.
   */
  private processCorrectResponse(
    cardRecord: QuestionRecord,
    history: CardHistory<CardRecord>,
    studySessionItem: StudySessionItem,
    courseRegistrationDoc: CourseRegistrationDoc,
    currentCard: StudySessionRecord,
    courseId: string,
    cardId: string
  ): ResponseResult {
    // Only schedule and update ELO for first-time attempts
    if (cardRecord.priorAttemps === 0) {
      // Schedule the card for future review based on performance (async, non-blocking)
      void this.srsService.scheduleReview(history, studySessionItem);

      // Parse performance (may be numeric or structured)
      const { globalScore, taggedPerformance } = this.parsePerformance(cardRecord.performance);

      // Update ELO ratings
      if (taggedPerformance) {
        // Per-tag ELO update
        void this.eloService.updateUserAndCardEloPerTag(
          taggedPerformance,
          courseId,
          cardId,
          courseRegistrationDoc,
          currentCard
        );
        logger.info(
          `[ResponseProcessor] Processed correct response with per-tag ELO update (${Object.keys(taggedPerformance).length - 1} tags)`
        );
      } else {
        // Standard single-score ELO update (backward compatible)
        const userScore = 0.5 + globalScore / 2;

        if (history.records.length === 1) {
          // First interaction with this card - standard ELO update
          void this.eloService.updateUserAndCardElo(
            userScore,
            courseId,
            cardId,
            courseRegistrationDoc,
            currentCard
          );
        } else {
          // Multiple interactions - reduce K-factor to limit ELO volatility
          const k = Math.ceil(32 / history.records.length);
          void this.eloService.updateUserAndCardElo(
            userScore,
            courseId,
            cardId,
            courseRegistrationDoc,
            currentCard,
            k
          );
        }
        logger.info(
          '[ResponseProcessor] Processed correct response with SRS scheduling and ELO update'
        );
      }

      return {
        nextCardAction: 'dismiss-success',
        shouldLoadNextCard: true,
        isCorrect: true,
        performanceScore: globalScore,
        shouldClearFeedbackShadow: true,
      };
    } else {
      logger.info(
        '[ResponseProcessor] Processed correct response (retry attempt - no scheduling/ELO)'
      );

      const { globalScore } = this.parsePerformance(cardRecord.performance);

      return {
        nextCardAction: 'marked-failed',
        shouldLoadNextCard: true,
        isCorrect: true,
        performanceScore: globalScore,
        shouldClearFeedbackShadow: true,
      };
    }
  }

  /**
   * Handles processing for incorrect responses: ELO updates only.
   */
  private processIncorrectResponse(
    cardRecord: QuestionRecord,
    history: CardHistory<CardRecord>,
    courseRegistrationDoc: CourseRegistrationDoc,
    currentCard: StudySessionRecord,
    courseId: string,
    cardId: string,
    maxAttemptsPerView: number,
    maxSessionViews: number,
    sessionViews: number
  ): ResponseResult {
    // Parse performance (may be numeric or structured)
    const { taggedPerformance } = this.parsePerformance(cardRecord.performance);

    // Update ELO for first-time failures (not subsequent attempts on same card)
    if (history.records.length !== 1 && cardRecord.priorAttemps === 0) {
      if (taggedPerformance) {
        // Per-tag ELO update for incorrect response
        void this.eloService.updateUserAndCardEloPerTag(
          taggedPerformance,
          courseId,
          cardId,
          courseRegistrationDoc,
          currentCard
        );
        logger.info(
          `[ResponseProcessor] Processed incorrect response with per-tag ELO update (${Object.keys(taggedPerformance).length - 1} tags)`
        );
      } else {
        // Standard single-score ELO update
        void this.eloService.updateUserAndCardElo(
          0, // Failed response = 0 score
          courseId,
          cardId,
          courseRegistrationDoc,
          currentCard
        );
        logger.info('[ResponseProcessor] Processed incorrect response with ELO update');
      }
    } else {
      logger.info('[ResponseProcessor] Processed incorrect response (no ELO update needed)');
    }

    // Determine navigation based on attempt limits
    if (currentCard.records.length >= maxAttemptsPerView) {
      if (sessionViews >= maxSessionViews) {
        // Too many session views - dismiss completely with ELO penalty
        if (taggedPerformance) {
          // Use tagged performance for final failure
          void this.eloService.updateUserAndCardEloPerTag(
            taggedPerformance,
            courseId,
            cardId,
            courseRegistrationDoc,
            currentCard
          );
        } else {
          void this.eloService.updateUserAndCardElo(
            0,
            courseId,
            cardId,
            courseRegistrationDoc,
            currentCard
          );
        }
        return {
          nextCardAction: 'dismiss-failed',
          shouldLoadNextCard: true,
          isCorrect: false,
          shouldClearFeedbackShadow: true,
        };
      } else {
        // Mark as failed for later retry
        return {
          nextCardAction: 'marked-failed',
          shouldLoadNextCard: true,
          isCorrect: false,
          shouldClearFeedbackShadow: true,
        };
      }
    } else {
      // Allow more attempts on same card
      return {
        nextCardAction: 'none',
        shouldLoadNextCard: false,
        isCorrect: false,
        shouldClearFeedbackShadow: true,
      };
    }
  }
}
