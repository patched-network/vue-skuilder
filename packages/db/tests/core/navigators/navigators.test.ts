import { describe, it, expect, beforeEach } from 'vitest';
import { ContentNavigator, WeightedCard } from '../../../src/core/navigators/index';
import { StudySessionNewItem, StudySessionReviewItem } from '../../../src/core';
import { ScheduledCard } from '../../../src/core/types/user';

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

describe('HierarchyDefinition mastery detection', () => {
  // Test the mastery logic without full DB mocking

  interface MockTagElo {
    score: number;
    count: number;
  }

  interface MasteryThreshold {
    minElo?: number;
    minCount?: number;
  }

  function isTagMastered(
    tagElo: MockTagElo | undefined,
    threshold: MasteryThreshold | undefined,
    userGlobalElo: number
  ): boolean {
    if (!tagElo) return false;

    const minCount = threshold?.minCount ?? 3;
    if (tagElo.count < minCount) return false;

    if (threshold?.minElo !== undefined) {
      return tagElo.score >= threshold.minElo;
    } else {
      // Default: user ELO for tag > global user ELO
      return tagElo.score >= userGlobalElo;
    }
  }

  it('should return false when tag has no ELO data', () => {
    expect(isTagMastered(undefined, {}, 1000)).toBe(false);
  });

  it('should return false when count is below threshold', () => {
    expect(isTagMastered({ score: 1200, count: 2 }, { minCount: 3 }, 1000)).toBe(false);
  });

  it('should return true when count meets threshold and ELO exceeds minElo', () => {
    expect(isTagMastered({ score: 1100, count: 5 }, { minElo: 1000, minCount: 3 }, 900)).toBe(true);
  });

  it('should return false when ELO is below minElo threshold', () => {
    expect(isTagMastered({ score: 900, count: 5 }, { minElo: 1000, minCount: 3 }, 800)).toBe(false);
  });

  it('should compare to global ELO when no minElo specified', () => {
    // Tag ELO above global = mastered
    expect(isTagMastered({ score: 1100, count: 5 }, {}, 1000)).toBe(true);
    // Tag ELO below global = not mastered
    expect(isTagMastered({ score: 900, count: 5 }, {}, 1000)).toBe(false);
  });

  it('should use default minCount of 3', () => {
    expect(isTagMastered({ score: 1100, count: 3 }, {}, 1000)).toBe(true);
    expect(isTagMastered({ score: 1100, count: 2 }, {}, 1000)).toBe(false);
  });
});

describe('HierarchyDefinition unlocking logic', () => {
  interface TagPrerequisite {
    requires: string[];
  }

  function getUnlockedTags(
    prerequisites: { [tagId: string]: TagPrerequisite },
    masteredTags: Set<string>
  ): Set<string> {
    const unlocked = new Set<string>();

    for (const [tagId, prereq] of Object.entries(prerequisites)) {
      const allPrereqsMet = prereq.requires.every((req) => masteredTags.has(req));
      if (allPrereqsMet) {
        unlocked.add(tagId);
      }
    }

    return unlocked;
  }

  it('should unlock tag when all prerequisites are mastered', () => {
    const prerequisites = {
      'tag-b': { requires: ['tag-a'] },
    };
    const mastered = new Set(['tag-a']);

    const unlocked = getUnlockedTags(prerequisites, mastered);

    expect(unlocked.has('tag-b')).toBe(true);
  });

  it('should not unlock tag when some prerequisites are missing', () => {
    const prerequisites = {
      'tag-c': { requires: ['tag-a', 'tag-b'] },
    };
    const mastered = new Set(['tag-a']); // missing tag-b

    const unlocked = getUnlockedTags(prerequisites, mastered);

    expect(unlocked.has('tag-c')).toBe(false);
  });

  it('should unlock tag when it has empty prerequisites', () => {
    const prerequisites = {
      'tag-root': { requires: [] },
    };
    const mastered = new Set<string>();

    const unlocked = getUnlockedTags(prerequisites, mastered);

    expect(unlocked.has('tag-root')).toBe(true);
  });

  it('should handle chain of prerequisites', () => {
    const prerequisites = {
      'tag-b': { requires: ['tag-a'] },
      'tag-c': { requires: ['tag-b'] },
    };

    // Only tag-a mastered: tag-b unlocks, tag-c does not
    const mastered1 = new Set(['tag-a']);
    const unlocked1 = getUnlockedTags(prerequisites, mastered1);
    expect(unlocked1.has('tag-b')).toBe(true);
    expect(unlocked1.has('tag-c')).toBe(false);

    // tag-a and tag-b mastered: both tag-b and tag-c unlock
    const mastered2 = new Set(['tag-a', 'tag-b']);
    const unlocked2 = getUnlockedTags(prerequisites, mastered2);
    expect(unlocked2.has('tag-b')).toBe(true);
    expect(unlocked2.has('tag-c')).toBe(true);
  });

  it('should handle multiple prerequisites', () => {
    const prerequisites = {
      'cvc-words': { requires: ['letter-s', 'letter-a', 'letter-t'] },
    };

    // Missing one prerequisite
    const mastered1 = new Set(['letter-s', 'letter-a']);
    expect(getUnlockedTags(prerequisites, mastered1).has('cvc-words')).toBe(false);

    // All prerequisites met
    const mastered2 = new Set(['letter-s', 'letter-a', 'letter-t']);
    expect(getUnlockedTags(prerequisites, mastered2).has('cvc-words')).toBe(true);
  });
});

describe('HierarchyDefinition card unlocking', () => {
  function isCardUnlocked(
    cardTags: string[],
    unlockedTags: Set<string>,
    hasPrerequisites: (tag: string) => boolean
  ): boolean {
    return cardTags.every((tag) => unlockedTags.has(tag) || !hasPrerequisites(tag));
  }

  it('should unlock card when all its tags are unlocked', () => {
    const cardTags = ['tag-a', 'tag-b'];
    const unlockedTags = new Set(['tag-a', 'tag-b']);
    const hasPrereqs = () => true;

    expect(isCardUnlocked(cardTags, unlockedTags, hasPrereqs)).toBe(true);
  });

  it('should lock card when any tag is locked', () => {
    const cardTags = ['tag-a', 'tag-b'];
    const unlockedTags = new Set(['tag-a']); // tag-b not unlocked
    const hasPrereqs = () => true;

    expect(isCardUnlocked(cardTags, unlockedTags, hasPrereqs)).toBe(false);
  });

  it('should unlock card when tag has no prerequisites defined', () => {
    const cardTags = ['tag-without-prereqs'];
    const unlockedTags = new Set<string>(); // nothing explicitly unlocked
    const hasPrereqs = (tag: string) => tag !== 'tag-without-prereqs';

    expect(isCardUnlocked(cardTags, unlockedTags, hasPrereqs)).toBe(true);
  });

  it('should handle mixed tags (some with prereqs, some without)', () => {
    const cardTags = ['defined-tag', 'root-tag'];
    const unlockedTags = new Set(['defined-tag']);
    const hasPrereqs = (tag: string) => tag === 'defined-tag';

    // defined-tag is unlocked, root-tag has no prereqs = card unlocked
    expect(isCardUnlocked(cardTags, unlockedTags, hasPrereqs)).toBe(true);
  });

  it('should lock card when defined tag is not unlocked', () => {
    const cardTags = ['defined-tag', 'root-tag'];
    const unlockedTags = new Set<string>(); // defined-tag not unlocked
    const hasPrereqs = (tag: string) => tag === 'defined-tag';

    expect(isCardUnlocked(cardTags, unlockedTags, hasPrereqs)).toBe(false);
  });
});
