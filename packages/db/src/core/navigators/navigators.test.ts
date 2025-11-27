import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentNavigator, WeightedCard } from './index';
import { StudySessionNewItem, StudySessionReviewItem } from '..';
import { ScheduledCard } from '../types/user';

// Mock implementation of ContentNavigator for testing the default getWeightedCards
class MockNavigator extends ContentNavigator {
  private mockNewCards: StudySessionNewItem[] = [];
  private mockReviews: (StudySessionReviewItem & ScheduledCard)[] = [];

  setMockNewCards(cards: StudySessionNewItem[]) {
    this.mockNewCards = cards;
  }

  setMockReviews(reviews: (StudySessionReviewItem & ScheduledCard)[]) {
    this.mockReviews = reviews;
  }

  async getNewCards(n?: number): Promise<StudySessionNewItem[]> {
    return this.mockNewCards.slice(0, n);
  }

  async getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]> {
    return this.mockReviews;
  }
}

describe('WeightedCard', () => {
  it('should have correct structure', () => {
    const card: WeightedCard = {
      cardId: 'card-1',
      courseId: 'course-1',
      score: 0.8,
      source: 'new',
    };

    expect(card.cardId).toBe('card-1');
    expect(card.courseId).toBe('course-1');
    expect(card.score).toBe(0.8);
    expect(card.source).toBe('new');
  });

  it('should accept all valid source types', () => {
    const sources: Array<'new' | 'review' | 'failed'> = ['new', 'review', 'failed'];

    sources.forEach((source) => {
      const card: WeightedCard = {
        cardId: 'card-1',
        courseId: 'course-1',
        score: 1.0,
        source,
      };
      expect(card.source).toBe(source);
    });
  });
});

describe('ContentNavigator.getWeightedCards', () => {
  let navigator: MockNavigator;

  beforeEach(() => {
    navigator = new MockNavigator();
  });

  it('should return empty array when no cards available', async () => {
    navigator.setMockNewCards([]);
    navigator.setMockReviews([]);

    const result = await navigator.getWeightedCards(10);

    expect(result).toEqual([]);
  });

  it('should assign score=1.0 to all cards by default', async () => {
    navigator.setMockNewCards([
      {
        cardID: 'card-1',
        courseID: 'course-1',
        contentSourceType: 'course',
        contentSourceID: 'course-1',
        status: 'new',
      },
      {
        cardID: 'card-2',
        courseID: 'course-1',
        contentSourceType: 'course',
        contentSourceID: 'course-1',
        status: 'new',
      },
    ]);

    const result = await navigator.getWeightedCards(10);

    expect(result).toHaveLength(2);
    expect(result[0].score).toBe(1.0);
    expect(result[1].score).toBe(1.0);
  });

  it('should mark new cards with source="new"', async () => {
    navigator.setMockNewCards([
      {
        cardID: 'card-1',
        courseID: 'course-1',
        contentSourceType: 'course',
        contentSourceID: 'course-1',
        status: 'new',
      },
    ]);

    const result = await navigator.getWeightedCards(10);

    expect(result[0].source).toBe('new');
  });

  it('should mark reviews with source="review"', async () => {
    navigator.setMockReviews([
      {
        cardID: 'review-1',
        courseID: 'course-1',
        contentSourceType: 'course',
        contentSourceID: 'course-1',
        status: 'review',
        reviewID: 'review-id-1',
        qualifiedID: 'course-1-review-1',
        _id: 'scheduled-1',
        cardId: 'review-1',
        courseId: 'course-1',
        scheduledFor: 'course',
        schedulingAgentId: 'agent-1',
      } as StudySessionReviewItem & ScheduledCard,
    ]);

    const result = await navigator.getWeightedCards(10);

    expect(result[0].source).toBe('review');
  });

  it('should respect limit parameter', async () => {
    navigator.setMockNewCards([
      {
        cardID: 'card-1',
        courseID: 'course-1',
        contentSourceType: 'course',
        contentSourceID: 'course-1',
        status: 'new',
      },
      {
        cardID: 'card-2',
        courseID: 'course-1',
        contentSourceType: 'course',
        contentSourceID: 'course-1',
        status: 'new',
      },
      {
        cardID: 'card-3',
        courseID: 'course-1',
        contentSourceType: 'course',
        contentSourceID: 'course-1',
        status: 'new',
      },
    ]);

    const result = await navigator.getWeightedCards(2);

    expect(result).toHaveLength(2);
  });

  it('should combine new cards and reviews', async () => {
    navigator.setMockNewCards([
      {
        cardID: 'new-1',
        courseID: 'course-1',
        contentSourceType: 'course',
        contentSourceID: 'course-1',
        status: 'new',
      },
    ]);
    navigator.setMockReviews([
      {
        cardID: 'review-1',
        courseID: 'course-1',
        contentSourceType: 'course',
        contentSourceID: 'course-1',
        status: 'review',
        reviewID: 'review-id-1',
        qualifiedID: 'course-1-review-1',
        _id: 'scheduled-1',
        cardId: 'review-1',
        courseId: 'course-1',
        scheduledFor: 'course',
        schedulingAgentId: 'agent-1',
      } as StudySessionReviewItem & ScheduledCard,
    ]);

    const result = await navigator.getWeightedCards(10);

    expect(result).toHaveLength(2);
    const sources = result.map((c) => c.source);
    expect(sources).toContain('new');
    expect(sources).toContain('review');
  });

  it('should correctly map cardID to cardId and courseID to courseId', async () => {
    navigator.setMockNewCards([
      {
        cardID: 'CARD-123',
        courseID: 'COURSE-456',
        contentSourceType: 'course',
        contentSourceID: 'COURSE-456',
        status: 'new',
      },
    ]);

    const result = await navigator.getWeightedCards(10);

    expect(result[0].cardId).toBe('CARD-123');
    expect(result[0].courseId).toBe('COURSE-456');
  });
});

describe('ELO scoring formula', () => {
  // These tests verify the scoring formula: max(0, 1 - distance / 500)
  // Note: We test the formula logic, not the full ELONavigator (which requires mocking DB)

  function calculateEloScore(userElo: number, cardElo: number): number {
    const distance = Math.abs(cardElo - userElo);
    return Math.max(0, 1 - distance / 500);
  }

  it('should return 1.0 when ELOs match exactly', () => {
    expect(calculateEloScore(1000, 1000)).toBe(1.0);
  });

  it('should return 0.5 when distance is 250', () => {
    expect(calculateEloScore(1000, 1250)).toBe(0.5);
    expect(calculateEloScore(1000, 750)).toBe(0.5);
  });

  it('should return 0 when distance is 500 or more', () => {
    expect(calculateEloScore(1000, 1500)).toBe(0);
    expect(calculateEloScore(1000, 500)).toBe(0);
    expect(calculateEloScore(1000, 2000)).toBe(0);
  });

  it('should return intermediate values for intermediate distances', () => {
    expect(calculateEloScore(1000, 1100)).toBeCloseTo(0.8);
    expect(calculateEloScore(1000, 900)).toBeCloseTo(0.8);
    expect(calculateEloScore(1000, 1200)).toBeCloseTo(0.6);
  });

  it('should never return negative values', () => {
    expect(calculateEloScore(0, 1000)).toBe(0);
    expect(calculateEloScore(1000, 0)).toBe(0);
  });
});
