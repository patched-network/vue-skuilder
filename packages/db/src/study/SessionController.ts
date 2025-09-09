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

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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
   *
   */
  constructor(
    sources: StudyContentSource[],
    time: number,
    dataLayer: DataLayerProvider,
    getViewComponent: (viewId: string) => TView
  ) {
    super();

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
      await Promise.all([this.getScheduledReviews(), this.getNewCards()]);
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

  private async getScheduledReviews() {
    const reviews = await Promise.all(
      this.sources.map((c) =>
        c.getPendingReviews().catch((error) => {
          this.error(`Failed to get reviews for source ${c}:`, error);
          return [];
        })
      )
    );

    const dueCards: (StudySessionReviewItem & ScheduledCard)[] = [];

    while (reviews.length != 0 && reviews.some((r) => r.length > 0)) {
      // pick a random review source
      const index = randomInt(0, reviews.length - 1);
      const source = reviews[index];

      if (source.length === 0) {
        reviews.splice(index, 1);
        continue;
      } else {
        dueCards.push(source.shift()!);
      }
    }

    let report = 'Review session created with:\n';
    this.reviewQ.addAll(dueCards, (c) => c.cardID);
    report += dueCards.map((card) => `Card ${card.courseID}::${card.cardID} `).join('\n');
    this.log(report);
  }

  private async getNewCards(n: number = 10) {
    const perCourse = Math.ceil(n / this.sources.length);
    const newContent = await Promise.all(this.sources.map((c) => c.getNewCards(perCourse)));

    // [ ] is this a noop?
    newContent.forEach((newContentFromSource) => {
      newContentFromSource.filter((c) => {
        return this._sessionRecord.find((record) => record.card.card_id === c.cardID) === undefined;
      });
    });

    while (n > 0 && newContent.some((nc) => nc.length > 0)) {
      for (let i = 0; i < newContent.length; i++) {
        if (newContent[i].length > 0) {
          const item = newContent[i].splice(0, 1)[0];
          this.log(`Adding new card: ${item.courseID}::${item.cardID}`);
          this.newQ.add(item, item.cardID);
          n--;
        }
      }
    }
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
