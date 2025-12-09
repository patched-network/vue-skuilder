import { SrsService } from './services/SrsService';
import { EloService } from './services/EloService';
import { ResponseProcessor } from './services/ResponseProcessor';
import { CardHydrationService, HydratedCard } from './services/CardHydrationService';
import { ItemQueue } from './ItemQueue';
import {
  isReview,
  StudyContentSource,
  StudySessionFailedItem,
  StudySessionItem,
  StudySessionNewItem,
  StudySessionReviewItem,
} from '@db/impl/couch';

import { CardRecord, CardHistory, CourseRegistrationDoc } from '@db/core';
import { Loggable } from '@db/util';
import { ScheduledCard } from '@db/core/types/user';
import { getCardOrigin } from '@db/core/navigators';
import { SourceMixer, QuotaRoundRobinMixer, SourceBatch } from './SourceMixer';

export interface StudySessionRecord {
  card: {
    course_id: string;
    card_id: string;
    card_elo: number;
  };
  item: StudySessionItem;
  records: CardRecord[];
}

import { DataLayerProvider } from '@db/core';

export type SessionAction =
  | 'dismiss-success'
  | 'dismiss-failed'
  | 'marked-failed'
  | 'dismiss-error';

export interface ResponseResult {
  // Navigation
  nextCardAction: Exclude<SessionAction, 'dismiss-error'> | 'none';
  shouldLoadNextCard: boolean;

  // UI Data (let view decide how to render)
  isCorrect: boolean;
  performanceScore?: number; // for shadow color calculation

  // Cleanup
  shouldClearFeedbackShadow: boolean;
}

interface SessionServices {
  response: ResponseProcessor;
}

export class SessionController<TView = unknown> extends Loggable {
  _className = 'SessionController';

  public services: SessionServices;
  private srsService: SrsService;
  private eloService: EloService;
  private hydrationService: CardHydrationService<TView>;
  private mixer: SourceMixer;

  private sources: StudyContentSource[];
  // dataLayer and getViewComponent now injected into CardHydrationService
  private _sessionRecord: StudySessionRecord[] = [];
  public set sessionRecord(r: StudySessionRecord[]) {
    this._sessionRecord = r;
  }

  // Session card stores
  private _currentCard: HydratedCard<TView> | null = null;

  private reviewQ: ItemQueue<StudySessionReviewItem> = new ItemQueue<StudySessionReviewItem>();
  private newQ: ItemQueue<StudySessionNewItem> = new ItemQueue<StudySessionNewItem>();
  private failedQ: ItemQueue<StudySessionFailedItem> = new ItemQueue<StudySessionFailedItem>();
  // END   Session card stores

  private startTime: Date;
  private endTime: Date;
  private _secondsRemaining: number;
  public get secondsRemaining(): number {
    return this._secondsRemaining;
  }
  public get report(): string {
    return `${this.reviewQ.dequeueCount} reviews, ${this.newQ.dequeueCount} new cards`;
  }
  public get detailedReport(): string {
    return this.newQ.toString + '\n' + this.reviewQ.toString + '\n' + this.failedQ.toString;
  }
  // @ts-expect-error NodeJS.Timeout type not available in browser context
  private _intervalHandle: NodeJS.Timeout;

  /**
   * @param sources - Array of content sources to mix for the session
   * @param time - Session duration in seconds
   * @param dataLayer - Data layer provider
   * @param getViewComponent - Function to resolve view components
   * @param mixer - Optional source mixer strategy (defaults to QuotaRoundRobinMixer)
   */
  constructor(
    sources: StudyContentSource[],
    time: number,
    dataLayer: DataLayerProvider,
    getViewComponent: (viewId: string) => TView,
    mixer?: SourceMixer
  ) {
    super();

    this.mixer = mixer || new QuotaRoundRobinMixer();
    this.srsService = new SrsService(dataLayer.getUserDB());
    this.eloService = new EloService(dataLayer, dataLayer.getUserDB());

    this.hydrationService = new CardHydrationService<TView>(
      getViewComponent,
      (courseId: string) => dataLayer.getCourseDB(courseId),
      () => this._selectNextItemToHydrate(),
      (item: StudySessionItem) => this.removeItemFromQueue(item),
      () => this.hasAvailableCards()
    );

    this.services = {
      response: new ResponseProcessor(this.srsService, this.eloService),
    };

    this.sources = sources;
    this.startTime = new Date();
    this._secondsRemaining = time;
    this.endTime = new Date(this.startTime.valueOf() + 1000 * this._secondsRemaining);

    this.log(`Session constructed:
    startTime: ${this.startTime}
    endTime: ${this.endTime}`);
  }

  private tick() {
    this._secondsRemaining = Math.floor((this.endTime.valueOf() - Date.now()) / 1000);
    // this.log(this.secondsRemaining);

    if (this._secondsRemaining <= 0) {
      clearInterval(this._intervalHandle);
    }
  }

  /**
   * Returns a rough, erring toward conservative, guess at
   * the amount of time the failed cards queue will require
   * to clean up.
   *
   * (seconds)
   */
  private estimateCleanupTime(): number {
    let time: number = 0;
    for (let i = 0; i < this.failedQ.length; i++) {
      const c = this.failedQ.peek(i);
      // this.log(`Failed card ${c.qualifiedID} found`)

      const record = this._sessionRecord.find((r) => r.item.cardID === c.cardID);
      let cardTime = 0;

      if (record) {
        // this.log(`Card Record Found...`);
        for (let j = 0; j < record.records.length; j++) {
          cardTime += record.records[j].timeSpent;
        }
        cardTime = cardTime / record.records.length;
        time += cardTime;
      }
    }

    const ret: number = time / 1000;
    this.log(`Failed card cleanup estimate: ${Math.round(ret)}`);
    return ret;
  }

  /**
   * Extremely rough, conservative, estimate of amound of time to complete
   * all scheduled reviews
   */
  private estimateReviewTime(): number {
    const ret = 5 * this.reviewQ.length;
    this.log(`Review card time estimate: ${ret}`);
    return ret;
  }

  public async prepareSession() {
    try {
      // All content sources must implement getWeightedCards()
      if (this.sources.some((s) => typeof s.getWeightedCards !== 'function')) {
        throw new Error(
          '[SessionController] All content sources must implement getWeightedCards(). ' +
          'Legacy getNewCards()/getPendingReviews() API is no longer supported.'
        );
      }

      await this.getWeightedContent();
    } catch (e) {
      this.error('Error preparing study session:', e);
    }

    await this.hydrationService.ensureHydratedCards();

    this._intervalHandle = setInterval(() => {
      this.tick();
    }, 1000);
  }

  public addTime(seconds: number) {
    this.endTime = new Date(this.endTime.valueOf() + 1000 * seconds);
  }

  public get failedCount(): number {
    return this.failedQ.length;
  }

  public toString() {
    return `Session: ${this.reviewQ.length} Reviews, ${this.newQ.length} New, ${this.failedQ.length} failed`;
  }
  public reportString() {
    return `${this.reviewQ.dequeueCount} Reviews, ${this.newQ.dequeueCount} New, ${this.failedQ.dequeueCount} failed`;
  }

  /**
   * Returns debug information about the current session state.
   * Used by SessionControllerDebug component for runtime inspection.
   */
  public getDebugInfo() {
    // Check if sources support weighted cards
    const supportsWeightedCards = this.sources.some(
      (s) => typeof s.getWeightedCards === 'function'
    );

    const extractQueueItems = (queue: ItemQueue<any>, limit: number = 10) => {
      const items = [];
      for (let i = 0; i < Math.min(queue.length, limit); i++) {
        const item = queue.peek(i);
        items.push({
          courseID: item.courseID || 'unknown',
          cardID: item.cardID || 'unknown',
          status: item.status || 'unknown',
        });
      }
      return items;
    };

    const extractHydratedItems = () => {
      // We can't easily iterate the hydrated queue without dequeuing,
      // so we'll just report the count via hydratedCache.count below

      const items: any[] = [];
      return items;
    };

    return {
      api: {
        mode: supportsWeightedCards ? 'weighted' : 'legacy',
        description: supportsWeightedCards
          ? 'Using getWeightedCards() API with scored candidates'
          : 'Using legacy getNewCards()/getPendingReviews() API',
      },
      reviewQueue: {
        length: this.reviewQ.length,
        dequeueCount: this.reviewQ.dequeueCount,
        items: extractQueueItems(this.reviewQ),
      },
      newQueue: {
        length: this.newQ.length,
        dequeueCount: this.newQ.dequeueCount,
        items: extractQueueItems(this.newQ),
      },
      failedQueue: {
        length: this.failedQ.length,
        dequeueCount: this.failedQ.dequeueCount,
        items: extractQueueItems(this.failedQ),
      },
      hydratedCache: {
        count: this.hydrationService.hydratedCount,
        failedCacheSize: this.hydrationService.failedCacheSize,
        items: extractHydratedItems(),
      },
    };
  }

  /**
   * Fetch content using the getWeightedCards API and mix across sources.
   *
   * This method:
   * 1. Fetches weighted cards from each source
   * 2. Fetches full review data (we need ScheduledCard fields for queue)
   * 3. Uses SourceMixer to balance content across sources
   * 4. Populates review and new card queues with mixed results
   */
  private async getWeightedContent() {
    const limit = 20; // Initial batch size per source

    // Collect batches from each source
    const batches: SourceBatch[] = [];
    const allReviews: (StudySessionReviewItem & ScheduledCard)[] = [];

    for (let i = 0; i < this.sources.length; i++) {
      const source = this.sources[i];
      try {
        // Fetch weighted cards for mixing
        const weighted = await source.getWeightedCards!(limit);

        // Fetch full review data (we need ScheduledCard fields)
        const reviews = await source.getPendingReviews().catch((error) => {
          this.error(`Failed to get reviews for source ${i}:`, error);
          return [];
        });

        batches.push({
          sourceIndex: i,
          weighted,
          reviews,
        });

        allReviews.push(...reviews);
      } catch (error) {
        this.error(`Failed to get content from source ${i}:`, error);
      }
    }

    // Mix weighted cards across sources using configured strategy
    const mixedWeighted = this.mixer.mix(batches, limit * this.sources.length);

    // Build score lookup map from mixed results
    const scoreMap = new Map<string, number>();
    for (const w of mixedWeighted) {
      const key = `${w.courseId}::${w.cardId}`;
      scoreMap.set(key, w.score);
    }

    // Sort reviews by their mixed scores
    const scoredReviews = allReviews.map((r) => ({
      review: r,
      score: scoreMap.get(`${r.courseID}::${r.cardID}`) ?? 1.0,
    }));
    scoredReviews.sort((a, b) => b.score - a.score);

    // Add reviews to queue in score order
    let report = 'Mixed content session created with:\n';
    for (const { review, score } of scoredReviews) {
      this.reviewQ.add(review, review.cardID);
      report += `Review: ${review.courseID}::${review.cardID} (score: ${score.toFixed(2)})\n`;
    }

    // Get new cards from mixed results (filter out reviews)
    const newCardWeighted = mixedWeighted.filter((w) => getCardOrigin(w) === 'new');

    // Add new cards to queue in mixed order
    for (const card of newCardWeighted) {
      const newItem: StudySessionNewItem = {
        cardID: card.cardId,
        courseID: card.courseId,
        contentSourceType: 'course',
        contentSourceID: card.courseId,
        status: 'new',
      };
      this.newQ.add(newItem, card.cardId);
      report += `New: ${card.courseId}::${card.cardId} (score: ${card.score.toFixed(2)})\n`;
    }

    this.log(report);
  }


  private _selectNextItemToHydrate(): StudySessionItem | null {
    const choice = Math.random();
    let newBound: number = 0.1;
    let reviewBound: number = 0.75;

    if (this.reviewQ.length === 0 && this.failedQ.length === 0 && this.newQ.length === 0) {
      // all queues empty - session is over (and course is complete?)
      return null;
    }

    if (this._secondsRemaining < 2 && this.failedQ.length === 0) {
      // session is over!
      return null;
    }

    // If timer expired, only return failed cards
    if (this._secondsRemaining <= 0) {
      if (this.failedQ.length > 0) {
        return this.failedQ.peek(0);
      } else {
        return null; // No more failed cards, session over
      }
    }

    // supply new cards at start of session
    if (this.newQ.dequeueCount < this.sources.length && this.newQ.length) {
      return this.newQ.peek(0);
    }

    const cleanupTime = this.estimateCleanupTime();
    const reviewTime = this.estimateReviewTime();
    const availableTime = this._secondsRemaining - (cleanupTime + reviewTime);

    // if time-remaing vs (reviewQ + failureQ) looks good,
    // lean toward newQ
    if (availableTime > 20) {
      newBound = 0.5;
      reviewBound = 0.9;
    }
    // else if time-remaining vs failureQ looks good,
    // lean toward reviewQ
    else if (this._secondsRemaining - cleanupTime > 20) {
      newBound = 0.05;
      reviewBound = 0.9;
    }
    // else (time-remaining vs failureQ looks bad!)
    // lean heavily toward failureQ
    else {
      newBound = 0.01;
      reviewBound = 0.1;
    }

    // exclude possibility of drawing from empty queues
    if (this.failedQ.length === 0) {
      reviewBound = 1;
    }
    if (this.reviewQ.length === 0) {
      newBound = reviewBound;
    }

    if (choice < newBound && this.newQ.length) {
      return this.newQ.peek(0);
    } else if (choice < reviewBound && this.reviewQ.length) {
      return this.reviewQ.peek(0);
    } else if (this.failedQ.length) {
      return this.failedQ.peek(0);
    } else {
      this.log(`No more cards available for the session!`);
      return null;
    }
  }

  public async nextCard(
    action: SessionAction = 'dismiss-success'
  ): Promise<HydratedCard<TView> | null> {
    // dismiss (or sort to failedQ) the current card
    this.dismissCurrentCard(action);

    if (this._secondsRemaining <= 0 && this.failedQ.length === 0) {
      this._currentCard = null;
      return null;
    }

    let card = this.hydrationService.dequeueHydratedCard();

    // If no hydrated card but source cards available, wait for hydration
    if (!card && this.hasAvailableCards()) {
      card = await this.hydrationService.waitForHydratedCard();
    }

    // Trigger background hydration to maintain cache (async, non-blocking)
    await this.hydrationService.ensureHydratedCards();

    if (card) {
      this._currentCard = card;
    } else {
      this._currentCard = null;
    }

    return card;
  }

  /**
   * Public API for processing user responses to cards.
   * @param cardRecord User's response record
   * @param cardHistory Promise resolving to the card's history
   * @param courseRegistrationDoc User's course registration document
   * @param currentCard Current study session record
   * @param courseId Course identifier
   * @param cardId Card identifier
   * @param maxAttemptsPerView Maximum attempts allowed per view
   * @param maxSessionViews Maximum session views for this card
   * @param sessionViews Current number of session views
   * @returns ResponseResult with navigation and UI instructions
   */
  public async submitResponse(
    cardRecord: CardRecord,
    cardHistory: Promise<CardHistory<CardRecord>>,
    courseRegistrationDoc: CourseRegistrationDoc,
    currentCard: StudySessionRecord,
    courseId: string,
    cardId: string,
    maxAttemptsPerView: number,
    maxSessionViews: number,
    sessionViews: number
  ): Promise<ResponseResult> {
    const studySessionItem: StudySessionItem = {
      ...currentCard.item,
    };

    return await this.services.response.processResponse(
      cardRecord,
      cardHistory,
      studySessionItem,
      courseRegistrationDoc,
      currentCard,
      courseId,
      cardId,
      maxAttemptsPerView,
      maxSessionViews,
      sessionViews
    );
  }

  private dismissCurrentCard(action: SessionAction = 'dismiss-success') {
    if (this._currentCard) {
      // this.log(`Running dismissCurrentCard on ${this._currentCard!.qualifiedID}`);
      // if (action.includes('dismiss')) {
      //   if (this._currentCard.status === 'review' ||
      //     this._currentCard.status === 'failed-review') {
      //     removeScheduledCardReview(this.user.getUsername(),
      //       (this._currentCard as StudySessionReviewItem).reviewID);
      //     this.log(`Dismissed review card: ${this._currentCard.qualifiedID}`)
      //   }
      // }

      if (action === 'dismiss-success') {
        // schedule a review - currently done in Study.vue
      } else if (action === 'marked-failed') {
        this.hydrationService.cacheFailedCard(this._currentCard);

        let failedItem: StudySessionFailedItem;

        if (isReview(this._currentCard.item)) {
          failedItem = {
            cardID: this._currentCard.item.cardID,
            courseID: this._currentCard.item.courseID,
            contentSourceID: this._currentCard.item.contentSourceID,
            contentSourceType: this._currentCard.item.contentSourceType,
            status: 'failed-review',
            reviewID: this._currentCard.item.reviewID,
          };
        } else {
          failedItem = {
            cardID: this._currentCard.item.cardID,
            courseID: this._currentCard.item.courseID,
            contentSourceID: this._currentCard.item.contentSourceID,
            contentSourceType: this._currentCard.item.contentSourceType,
            status: 'failed-new',
          };
        }

        this.failedQ.add(failedItem, failedItem.cardID);
      } else if (action === 'dismiss-error') {
        // some error logging?
      } else if (action === 'dismiss-failed') {
        // handled by Study.vue
      }
    }
  }

  private hasAvailableCards(): boolean {
    return this.reviewQ.length > 0 || this.newQ.length > 0 || this.failedQ.length > 0;
  }

  /**
   * Helper method for CardHydrationService to remove items from appropriate queue.
   */
  private removeItemFromQueue(item: StudySessionItem): void {
    if (this.reviewQ.peek(0) === item) {
      this.reviewQ.dequeue((queueItem) => queueItem.cardID);
    } else if (this.newQ.peek(0) === item) {
      this.newQ.dequeue((queueItem) => queueItem.cardID);
    } else {
      this.failedQ.dequeue((queueItem) => queueItem.cardID);
    }
  }
}
