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

    const history = await cardHistory;

    // Handle correct responses
    if (cardRecord.isCorrect) {
      return this.processCorrectResponse(
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
      return this.processIncorrectResponse(
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

      // Update ELO ratings
      if (history.records.length === 1) {
        // First interaction with this card - standard ELO update (async, non-blocking)
        const userScore = 0.5 + (cardRecord.performance as number) / 2;
        void this.eloService.updateUserAndCardElo(
          userScore,
          courseId,
          cardId,
          courseRegistrationDoc,
          currentCard
        );
      } else {
        // Multiple interactions - reduce K-factor to limit ELO volatility (async, non-blocking)
        const k = Math.ceil(32 / history.records.length);
        const userScore = 0.5 + (cardRecord.performance as number) / 2;
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

      return {
        nextCardAction: 'dismiss-success',
        shouldLoadNextCard: true,
        isCorrect: true,
        performanceScore: cardRecord.performance as number,
        shouldClearFeedbackShadow: true,
      };
    } else {
      logger.info(
        '[ResponseProcessor] Processed correct response (retry attempt - no scheduling/ELO)'
      );

      return {
        nextCardAction: 'marked-failed',
        shouldLoadNextCard: true,
        isCorrect: true,
        performanceScore: cardRecord.performance as number,
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
    // Update ELO for first-time failures (not subsequent attempts on same card) (async, non-blocking)
    if (history.records.length !== 1 && cardRecord.priorAttemps === 0) {
      void this.eloService.updateUserAndCardElo(
        0, // Failed response = 0 score
        courseId,
        cardId,
        courseRegistrationDoc,
        currentCard
      );
      logger.info('[ResponseProcessor] Processed incorrect response with ELO update');
    } else {
      logger.info('[ResponseProcessor] Processed incorrect response (no ELO update needed)');
    }

    // Determine navigation based on attempt limits
    if (currentCard.records.length >= maxAttemptsPerView) {
      if (sessionViews >= maxSessionViews) {
        // Too many session views - dismiss completely with ELO penalty (async, non-blocking)
        void this.eloService.updateUserAndCardElo(
          0,
          courseId,
          cardId,
          courseRegistrationDoc,
          currentCard
        );
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
