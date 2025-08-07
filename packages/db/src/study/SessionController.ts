import {
  isReview,
  StudyContentSource,
  StudySessionFailedItem,
  StudySessionItem,
  StudySessionNewItem,
  StudySessionReviewItem,
} from '@db/impl/couch';

import { CardRecord } from '@db/core';
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

class ItemQueue<T extends StudySessionItem> {
  private q: T[] = [];
  private seenCardIds: string[] = [];
  private _dequeueCount: number = 0;
  public get dequeueCount(): number {
    return this._dequeueCount;
  }

  public add(item: T) {
    if (this.seenCardIds.find((d) => d === item.cardID)) {
      return; // do not re-add a card to the same queue
    }

    this.seenCardIds.push(item.cardID);
    this.q.push(item);
  }
  public addAll(items: T[]) {
    items.forEach((i) => this.add(i));
  }
  public get length() {
    return this.q.length;
  }
  public peek(index: number): T {
    return this.q[index];
  }

  public dequeue(): T | null {
    if (this.q.length !== 0) {
      this._dequeueCount++;
      return this.q.splice(0, 1)[0];
    } else {
      return null;
    }
  }

  public get toString(): string {
    return (
      `${typeof this.q[0]}:\n` +
      this.q.map((i) => `\t${i.courseID}+${i.cardID}: ${i.status}`).join('\n')
    );
  }
}

export class SessionController extends Loggable {
  _className = 'SessionController';
  private sources: StudyContentSource[];
  private _sessionRecord: StudySessionRecord[] = [];
  public set sessionRecord(r: StudySessionRecord[]) {
    this._sessionRecord = r;
  }

  private reviewQ: ItemQueue<StudySessionReviewItem> = new ItemQueue<StudySessionReviewItem>();
  private newQ: ItemQueue<StudySessionNewItem> = new ItemQueue<StudySessionNewItem>();
  private failedQ: ItemQueue<StudySessionFailedItem> = new ItemQueue<StudySessionFailedItem>();
  private _currentCard: StudySessionItem | null = null;
  /**
   * Indicates whether the session has been initialized - eg, the
   * queues have been populated.
   */
  private _isInitialized: boolean = false;

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
  constructor(sources: StudyContentSource[], time: number) {
    super();

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

    if (this._secondsRemaining === 0) {
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

    this._isInitialized = true;

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
    for (let i = 0; i < dueCards.length; i++) {
      const card = dueCards[i];
      this.reviewQ.add(card);
      report += `\t${card.courseID}-${card.cardID}\n`;
    }
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
          this.log(`Adding new card: ${item.courseID}-${item.cardID}`); // revealed bug here w/ new prefixes.  osbserved log "Adding new card: 5e627b7f630998243834152aa00920f5-c"
          this.newQ.add(item);
          n--;
        }
      }
    }
  }

  private nextNewCard(): StudySessionNewItem | null {
    const item = this.newQ.dequeue();

    // queue some more content if we are getting low
    if (this._isInitialized && this.newQ.length < 5) {
      void this.getNewCards();
    }

    return item;
  }

  public nextCard(
    // [ ] this is often slow. Why?
    action:
      | 'dismiss-success'
      | 'dismiss-failed'
      | 'marked-failed'
      | 'dismiss-error' = 'dismiss-success'
  ): StudySessionItem | null {
    // dismiss (or sort to failedQ) the current card
    this.dismissCurrentCard(action);

    const choice = Math.random();
    let newBound: number = 0.1;
    let reviewBound: number = 0.75;

    if (this.reviewQ.length === 0 && this.failedQ.length === 0 && this.newQ.length === 0) {
      // all queues empty - session is over (and course is complete?)
      this._currentCard = null;
      return this._currentCard;
    }

    if (this._secondsRemaining < 2 && this.failedQ.length === 0) {
      // session is over!
      this._currentCard = null;
      return this._currentCard;
    }

    // supply new cards at start of session
    if (this.newQ.dequeueCount < this.sources.length && this.newQ.length) {
      this._currentCard = this.nextNewCard();
      return this._currentCard;
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

    // prevent (unless no other option available) re-display of
    // most recent card
    if (this.failedQ.length === 1 && action === 'marked-failed') {
      reviewBound = 1;
    }

    // exclude possibility of drawing from empty queues
    if (this.failedQ.length === 0) {
      reviewBound = 1;
    }
    if (this.reviewQ.length === 0) {
      newBound = reviewBound;
    }

    if (choice < newBound && this.newQ.length) {
      this._currentCard = this.nextNewCard();
    } else if (choice < reviewBound && this.reviewQ.length) {
      this._currentCard = this.reviewQ.dequeue();
    } else if (this.failedQ.length) {
      this._currentCard = this.failedQ.dequeue();
    } else {
      this.log(`No more cards available for the session!`);
      this._currentCard = null;
    }

    return this._currentCard;
  }

  private dismissCurrentCard(
    action:
      | 'dismiss-success'
      | 'dismiss-failed'
      | 'marked-failed'
      | 'dismiss-error' = 'dismiss-success'
  ) {
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
        let failedItem: StudySessionFailedItem;

        if (isReview(this._currentCard)) {
          failedItem = {
            cardID: this._currentCard.cardID,
            courseID: this._currentCard.courseID,
            contentSourceID: this._currentCard.contentSourceID,
            contentSourceType: this._currentCard.contentSourceType,
            status: 'failed-review',
            reviewID: this._currentCard.reviewID,
          };
        } else {
          failedItem = {
            cardID: this._currentCard.cardID,
            courseID: this._currentCard.courseID,
            contentSourceID: this._currentCard.contentSourceID,
            contentSourceType: this._currentCard.contentSourceType,
            status: 'failed-new',
          };
        }

        this.failedQ.add(failedItem);
      } else if (action === 'dismiss-error') {
        // some error logging?
      } else if (action === 'dismiss-failed') {
        // handled by Study.vue
      }
    }
  }
}
