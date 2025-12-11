import {
  displayableDataToViewData,
  CardData,
  DisplayableData,
  isCourseElo,
  toCourseElo,
} from '@vue-skuilder/common';
import { StudySessionItem } from '@db/impl/couch';
import { logger } from '@db/util/logger';
import { CourseDBInterface } from '@db/core';

/**
 * Extract audio URLs from arbitrary field data using heuristic pattern matching.
 * This is a "worse is better" approach - catches obvious URLs, silently ignores edge cases.
 */
function parseAudioURIs(data: unknown): string[] {
  if (typeof data !== 'string') return [];

  // Match URLs ending in common audio extensions
  const audioPattern = /https?:\/\/[^\s"'<>]+\.(wav|mp3|ogg|m4a|aac|webm)/gi;
  return data.match(audioPattern) ?? [];
}

/**
 * Prefetch an audio file by loading it into browser cache.
 * Resolves when the audio is ready to play (or on error, to avoid blocking).
 */
function prefetchAudio(url: string): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'auto';

    const cleanup = () => {
      audio.oncanplaythrough = null;
      audio.onerror = null;
    };

    audio.oncanplaythrough = () => {
      cleanup();
      resolve();
    };

    audio.onerror = () => {
      cleanup();
      logger.warn(`[CardHydrationService] Failed to prefetch audio: ${url}`);
      resolve(); // Don't block hydration on failed prefetch
    };

    audio.src = url;
  });
}

export interface HydratedCard<TView = unknown> {
  item: StudySessionItem;
  view: TView;
  data: any[];
}

/**
 * Service responsible for managing hydrated (ready-to-display) cards.
 * Uses a Map-based cache for direct ID lookup - no ordering assumptions.
 * SessionController owns all ordering decisions.
 */
export class CardHydrationService<TView = unknown> {
  private hydratedCards: Map<string, HydratedCard<TView>> = new Map();
  private hydrationInFlight: Set<string> = new Set();
  private hydrationInProgress: boolean = false;

  constructor(
    private getViewComponent: (viewId: string) => TView,
    private getCourseDB: (courseId: string) => CourseDBInterface,
    private getItemsToHydrate: () => StudySessionItem[]
  ) {}

  /**
   * Get a hydrated card by ID.
   * @returns Hydrated card or null if not in cache
   */
  public getHydratedCard(cardId: string): HydratedCard<TView> | null {
    return this.hydratedCards.get(cardId) ?? null;
  }

  /**
   * Check if a card is hydrated.
   */
  public hasHydratedCard(cardId: string): boolean {
    return this.hydratedCards.has(cardId);
  }

  /**
   * Remove a card from the cache (call on successful dismiss to free memory).
   */
  public removeCard(cardId: string): void {
    this.hydratedCards.delete(cardId);
  }

  /**
   * Check if hydration should be triggered and start background hydration if needed.
   */
  public async ensureHydratedCards(): Promise<void> {
    void this.fillHydratedCards();
  }

  /**
   * Wait for a specific card to become hydrated.
   * @returns Promise that resolves to a hydrated card or null
   */
  public async waitForCard(cardId: string): Promise<HydratedCard<TView> | null> {
    // If already hydrated, return immediately
    if (this.hydratedCards.has(cardId)) {
      return this.hydratedCards.get(cardId)!;
    }

    // Start hydration if not already in progress
    if (!this.hydrationInProgress) {
      void this.fillHydratedCards();
    }

    // Wait for the specific card to become available
    const maxWaitMs = 10000; // 10 second timeout
    const pollIntervalMs = 25;
    let elapsed = 0;

    while (elapsed < maxWaitMs) {
      if (this.hydratedCards.has(cardId)) {
        return this.hydratedCards.get(cardId)!;
      }

      // If the card is not in flight and not hydrated, it may have failed
      if (!this.hydrationInFlight.has(cardId) && !this.hydrationInProgress) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      elapsed += pollIntervalMs;
    }

    return this.hydratedCards.get(cardId) ?? null;
  }

  /**
   * Get current hydrated cache size.
   */
  public get hydratedCount(): number {
    return this.hydratedCards.size;
  }

  /**
   * Get list of currently hydrated card IDs (for debugging).
   */
  public getHydratedCardIds(): string[] {
    return Array.from(this.hydratedCards.keys());
  }

  /**
   * Fill the hydrated cache by hydrating items from getItemsToHydrate().
   * This is a pure cache-warming operation - no queue mutation.
   */
  private async fillHydratedCards(): Promise<void> {
    if (this.hydrationInProgress) {
      return; // Prevent concurrent hydration
    }

    this.hydrationInProgress = true;

    try {
      const itemsToHydrate = this.getItemsToHydrate();

      for (const item of itemsToHydrate) {
        // Skip if already hydrated or in flight
        if (this.hydratedCards.has(item.cardID) || this.hydrationInFlight.has(item.cardID)) {
          continue;
        }

        try {
          await this.hydrateCard(item);
        } catch (e) {
          logger.error(`[CardHydrationService] Error hydrating card ${item.cardID}:`, e);
        }
      }
    } finally {
      this.hydrationInProgress = false;
    }
  }

  /**
   * Hydrate a single card and add to cache.
   */
  private async hydrateCard(item: StudySessionItem): Promise<void> {
    if (this.hydratedCards.has(item.cardID) || this.hydrationInFlight.has(item.cardID)) {
      return; // Already hydrated or in progress
    }

    this.hydrationInFlight.add(item.cardID);

    try {
      const courseDB = this.getCourseDB(item.courseID);
      const cardData = await courseDB.getCourseDoc<CardData>(item.cardID);

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

      // Extract audio URLs from all data fields and prefetch them
      const audioToPrefetch: string[] = [];
      dataDocs.forEach((dd) => {
        dd.data.forEach((f) => {
          audioToPrefetch.push(...parseAudioURIs(f.data));
        });
      });

      // Dedupe and prefetch, waiting for browser cache to be ready
      const uniqueAudioUrls = [...new Set(audioToPrefetch)];
      if (uniqueAudioUrls.length > 0) {
        logger.debug(
          `[CardHydrationService] Prefetching ${uniqueAudioUrls.length} audio files for card ${item.cardID}`
        );
        await Promise.allSettled(uniqueAudioUrls.map(prefetchAudio));
      }

      const data = dataDocs.map(displayableDataToViewData).reverse();

      this.hydratedCards.set(item.cardID, {
        item,
        view,
        data,
      });

      logger.debug(`[CardHydrationService] Hydrated card ${item.cardID}`);
    } finally {
      this.hydrationInFlight.delete(item.cardID);
    }
  }
}
