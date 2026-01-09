/**
 * Mock StudyContentSource for testing SessionController.
 *
 * Provides controllable implementations of content sources
 * for testing session behavior without real pipeline logic.
 */

/**
 * Strategy contribution for provenance tracking.
 */
export interface StrategyContribution {
  strategy: string;
  strategyName: string;
  strategyId: string;
  action: 'generated' | 'passed' | 'boosted' | 'penalized';
  score: number;
  reason: string;
}

/**
 * WeightedCard for testing - matches the db package interface.
 */
export interface WeightedCard {
  cardId: string;
  courseId: string;
  score: number;
  provenance: StrategyContribution[];
  tags?: string[];
  elo?: { score: number };
  reviewID?: string;
}

/**
 * Configuration for a mock content source.
 */
export interface MockSourceConfig {
  /** Cards to return from getWeightedCards */
  cards: WeightedCard[];
  /** Whether to return cards from reviewQ (has history) */
  isReviewSource?: boolean;
  /** Simulated delay in ms (default: 0) */
  delay?: number;
}

/**
 * Simplified WeightedCard for test setup.
 */
export interface SimpleCard {
  cardId: string;
  courseId?: string;
  score?: number;
  tags?: string[];
  elo?: number;
}

/**
 * Mock implementation of StudyContentSource.
 *
 * Allows tests to control exactly what cards are returned
 * and track how the source is called.
 */
export class MockStudyContentSource {
  private cards: WeightedCard[];
  private isReviewSource: boolean;
  private delay: number;
  private callCount = 0;
  private lastRequestedCount = 0;

  constructor(config: MockSourceConfig) {
    this.cards = config.cards;
    this.isReviewSource = config.isReviewSource ?? false;
    this.delay = config.delay ?? 0;
  }

  /**
   * Get weighted cards (implements StudyContentSource interface).
   */
  async getWeightedCards(count: number): Promise<WeightedCard[]> {
    this.callCount++;
    this.lastRequestedCount = count;

    if (this.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delay));
    }

    return this.cards.slice(0, count);
  }

  /**
   * Check if this is a review source.
   */
  isReview(): boolean {
    return this.isReviewSource;
  }

  /**
   * Get how many times getWeightedCards was called.
   */
  getCallCount(): number {
    return this.callCount;
  }

  /**
   * Get the last requested count.
   */
  getLastRequestedCount(): number {
    return this.lastRequestedCount;
  }

  /**
   * Reset call tracking.
   */
  resetTracking(): void {
    this.callCount = 0;
    this.lastRequestedCount = 0;
  }

  /**
   * Update the cards this source returns.
   */
  setCards(cards: WeightedCard[]): void {
    this.cards = cards;
  }

  /**
   * Add a card to the source.
   */
  addCard(card: WeightedCard): void {
    this.cards.push(card);
  }

  /**
   * Remove a card from the source.
   */
  removeCard(cardId: string): void {
    this.cards = this.cards.filter((c) => c.cardId !== cardId);
  }

  /**
   * Clear all cards.
   */
  clearCards(): void {
    this.cards = [];
  }
}

/**
 * Create a simple WeightedCard for testing.
 */
export function createWeightedCard(simple: SimpleCard): WeightedCard {
  return {
    cardId: simple.cardId,
    courseId: simple.courseId ?? 'test-course',
    score: simple.score ?? 1.0,
    tags: simple.tags,
    elo: simple.elo ? { score: simple.elo } : undefined,
    provenance: [
      {
        strategy: 'mock',
        strategyName: 'MockSource',
        strategyId: 'mock-source-1',
        action: 'generated',
        score: simple.score ?? 1.0,
        reason: 'Mock card for testing',
      },
    ],
  };
}

/**
 * Create multiple WeightedCards from simple definitions.
 */
export function createWeightedCards(simples: SimpleCard[]): WeightedCard[] {
  return simples.map(createWeightedCard);
}

/**
 * Create a mock source with simple card definitions.
 */
export function createMockSource(
  cards: SimpleCard[],
  options?: Partial<MockSourceConfig>
): MockStudyContentSource {
  return new MockStudyContentSource({
    cards: createWeightedCards(cards),
    ...options,
  });
}

/**
 * Create a mock source with no cards (empty).
 */
export function createEmptyMockSource(
  isReviewSource = false
): MockStudyContentSource {
  return new MockStudyContentSource({
    cards: [],
    isReviewSource,
  });
}

/**
 * Create a mock source with graduated scores.
 * Useful for testing selection priority.
 */
export function createGradedMockSource(
  cardCount: number,
  baseId = 'card'
): MockStudyContentSource {
  const cards: SimpleCard[] = [];
  for (let i = 0; i < cardCount; i++) {
    cards.push({
      cardId: `${baseId}-${i + 1}`,
      score: (cardCount - i) / cardCount, // Descending scores
    });
  }
  return createMockSource(cards);
}

/**
 * Create a mock source that simulates review cards.
 */
export function createReviewMockSource(
  cards: SimpleCard[]
): MockStudyContentSource {
  return new MockStudyContentSource({
    cards: createWeightedCards(cards),
    isReviewSource: true,
  });
}