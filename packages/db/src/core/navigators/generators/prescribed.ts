import type { CourseDBInterface } from '../../interfaces/courseDB';
import type { UserDBInterface } from '../../interfaces/userDB';
import { ContentNavigator } from '../index';
import type { WeightedCard } from '../index';
import type { ContentNavigationStrategyData } from '../../types/contentNavigationStrategy';
import type { CardGenerator, GeneratorContext } from './types';
import { logger } from '@db/util/logger';

// ============================================================================
// PRESCRIBED CARDS GENERATOR
// ============================================================================
//
// A generator that always emits a configured list of card IDs at score 1.0.
//
// Use case: Cold-start curriculum bootstrapping. Ensures critical cards
// (e.g., intro-s, early WS exercises) are always in the candidate set
// regardless of ELO proximity sampling. Filters (hierarchy, priority)
// still run — cards whose utility has expired get penalized normally
// and drop out of the top-N selection.
//
// Config format:
//   { "cardIds": ["c-intro-s-S", "c-ws-sit-abc123", ...] }
//
// ============================================================================

interface PrescribedConfig {
  cardIds: string[];
}

export default class PrescribedCardsGenerator extends ContentNavigator implements CardGenerator {
  name: string;
  private config: PrescribedConfig;

  constructor(
    user: UserDBInterface,
    course: CourseDBInterface,
    strategyData: ContentNavigationStrategyData
  ) {
    super(user, course, strategyData);
    this.name = strategyData.name || 'Prescribed Cards';

    try {
      const parsed = JSON.parse(strategyData.serializedData);
      this.config = { cardIds: parsed.cardIds || [] };
    } catch {
      this.config = { cardIds: [] };
    }

    logger.debug(
      `[Prescribed] Initialized with ${this.config.cardIds.length} prescribed cards`
    );
  }

  async getWeightedCards(limit: number, _context?: GeneratorContext): Promise<WeightedCard[]> {
    if (this.config.cardIds.length === 0) {
      return [];
    }

    const courseId = this.course.getCourseID();

    // Filter out cards the user has already interacted with
    const activeCards = await this.user.getActiveCards();
    const activeIds = new Set(activeCards.map((ac) => ac.cardID));
    const eligibleIds = this.config.cardIds.filter((id) => !activeIds.has(id));

    if (eligibleIds.length === 0) {
      logger.debug('[Prescribed] All prescribed cards already active, returning empty');
      return [];
    }

    // Emit at score 1.0 — CompositeGenerator deduplicates, and if ELO
    // also surfaces the same card, the composite picks the higher score.
    const cards: WeightedCard[] = eligibleIds.slice(0, limit).map((cardId) => ({
      cardId,
      courseId,
      score: 1.0,
      provenance: [
        {
          strategy: 'prescribed',
          strategyName: this.strategyName || this.name,
          strategyId: this.strategyId || 'NAVIGATION_STRATEGY-prescribed',
          action: 'generated' as const,
          score: 1.0,
          reason: `Prescribed card (${eligibleIds.length} eligible of ${this.config.cardIds.length} configured)`,
        },
      ],
    }));

    logger.info(
      `[Prescribed] Emitting ${cards.length} cards (${eligibleIds.length} eligible, ${activeIds.size} already active)`
    );

    return cards;
  }
}
