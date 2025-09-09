import {
  displayableDataToViewData,
  CardData,
  DisplayableData,
  isCourseElo,
  toCourseElo,
} from '@vue-skuilder/common';
import { StudySessionItem } from '@db/impl/couch';
import { logger } from '@db/util/logger';
import { ItemQueue } from '../ItemQueue';
import { CourseDBInterface } from '@db/core';

export interface HydratedCard<TView = unknown> {
  item: StudySessionItem;
  view: TView;
  data: any[];
}

// ItemQueue now imported from separate file

/**
 * Service responsible for managing a queue of hydrated (ready-to-display) cards.
 * Handles pre-fetching card data, caching failed cards, and maintaining optimal buffer size.
 */
export class CardHydrationService<TView = unknown> {
  private hydratedQ: ItemQueue<HydratedCard<TView>> = new ItemQueue<HydratedCard<TView>>();
  private failedCardCache: Map<string, HydratedCard<TView>> = new Map();
  private hydrationInProgress: boolean = false;
  private readonly BUFFER_SIZE = 5;

  constructor(
    private getViewComponent: (viewId: string) => TView,
    private getCourseDB: (courseId: string) => CourseDBInterface,
    private selectNextItemToHydrate: () => StudySessionItem | null,
    private removeItemFromQueue: (item: StudySessionItem) => void,
    private hasAvailableCards: () => boolean
  ) {}

  /**
   * Get the next hydrated card from the queue.
   * @returns Hydrated card or null if none available
   */
  public dequeueHydratedCard(): HydratedCard<TView> | null {
    return this.hydratedQ.dequeue((item) => item.item.cardID);
  }

  /**
   * Check if hydration should be triggered and start background hydration if needed.
   */
  public async ensureHydratedCards(): Promise<void> {
    // Trigger background hydration to maintain cache (async, non-blocking)
    if (this.hydratedQ.length < 3) {
      void this.fillHydratedQueue();
    }
  }

  /**
   * Wait for a hydrated card to become available.
   * @returns Promise that resolves to a hydrated card or null
   */
  public async waitForHydratedCard(): Promise<HydratedCard<TView> | null> {
    // If no hydrated card but source cards available, start hydration
    if (this.hydratedQ.length === 0 && this.hasAvailableCards()) {
      void this.fillHydratedQueue(); // Start hydration in background
    }

    // Wait for a card to become available in hydratedQ
    while (this.hydratedQ.length === 0 && this.hasAvailableCards()) {
      await new Promise((resolve) => setTimeout(resolve, 25)); // Short polling interval
    }

    return this.dequeueHydratedCard();
  }

  /**
   * Get current hydrated queue length.
   */
  public get hydratedCount(): number {
    return this.hydratedQ.length;
  }

  /**
   * Fill the hydrated queue up to BUFFER_SIZE with pre-fetched cards.
   */
  private async fillHydratedQueue(): Promise<void> {
    if (this.hydrationInProgress) {
      return; // Prevent concurrent hydration
    }

    this.hydrationInProgress = true;

    try {
      while (this.hydratedQ.length < this.BUFFER_SIZE) {
        const nextItem = this.selectNextItemToHydrate();
        if (!nextItem) {
          return; // No more cards to hydrate
        }

        try {
          // Check cache first for failed cards
          if (this.failedCardCache.has(nextItem.cardID)) {
            const cachedCard = this.failedCardCache.get(nextItem.cardID)!;
            this.hydratedQ.add(cachedCard, cachedCard.item.cardID);
            this.failedCardCache.delete(nextItem.cardID);
          } else {
            // Hydrate new card using original logic pattern
            const courseDB = this.getCourseDB(nextItem.courseID);
            const cardData = await courseDB.getCourseDoc<CardData>(nextItem.cardID);

            if (!isCourseElo(cardData.elo)) {
              cardData.elo = toCourseElo(cardData.elo);
            }

            const view = this.getViewComponent(cardData.id_view);
            const dataDocs = await Promise.all(
              cardData.id_displayable_data.map((id: string) =>
                courseDB.getCourseDoc<DisplayableData>(id, {
                  attachments: true,
                  binary: true,
                })
              )
            );

            const data = dataDocs.map(displayableDataToViewData).reverse();

            this.hydratedQ.add(
              {
                item: nextItem,
                view,
                data,
              },
              nextItem.cardID
            );
          }
        } catch (e) {
          logger.error(`Error hydrating card ${nextItem.cardID}:`, e);
        } finally {
          // Remove the item from the original queue, regardless of success/failure/cache
          this.removeItemFromQueue(nextItem);
        }
      }
    } finally {
      this.hydrationInProgress = false;
    }
  }

  /**
   * Cache a failed card for quick re-access.
   */
  public cacheFailedCard(card: HydratedCard<TView>): void {
    this.failedCardCache.set(card.item.cardID, card);
  }
}
