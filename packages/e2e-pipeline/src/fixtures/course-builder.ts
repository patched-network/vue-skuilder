/**
 * Course Builder - Fluent API for constructing test courses.
 *
 * Provides a declarative way to build courses with cards and strategies
 * for e2e-pipeline tests.
 */

import { TestCourseDB } from '../harness/data-layer-factory';

/**
 * Card definition for building.
 */
export interface CardDefinition {
  shape: string;
  data: Record<string, unknown>;
  tags: string[];
  elo?: number;
}

/**
 * Strategy definition for building.
 */
export interface StrategyDefinition {
  name: string;
  implementingClass: string;
  description?: string;
  serializedData?: string;
}

/**
 * Result of building a course.
 */
export interface CourseBuilderResult {
  cardIds: string[];
  strategyIds: string[];
  cardIdsByTag: Map<string, string[]>;
}

/**
 * Fluent API for building test courses.
 *
 * @example
 * ```typescript
 * const builder = new CourseBuilder()
 *   .addFillInCard('What is 2+2?', '4', ['math', 'level-1'])
 *   .addFillInCard('What is 3+3?', '6', ['math', 'level-1'])
 *   .addFillInCard('Solve x²=4', 'x=±2', ['algebra', 'level-2'])
 *   .addHierarchyStrategy('progression', ['level-1', 'level-2', 'level-3'])
 *   .addEloStrategy('elo-match');
 *
 * const { cardIds, strategyIds } = await builder.build(courseDB);
 * ```
 */
export class CourseBuilder {
  private cards: CardDefinition[] = [];
  private strategies: StrategyDefinition[] = [];

  /**
   * Add a generic card.
   */
  addCard(
    shape: string,
    data: Record<string, unknown>,
    tags: string[] = [],
    elo?: number
  ): this {
    this.cards.push({ shape, data, tags, elo });
    return this;
  }

  /**
   * Add a fill-in-the-blank card.
   */
  addFillInCard(prompt: string, answer: string, tags: string[] = [], elo?: number): this {
    return this.addCard('fillIn', { prompt, answer }, tags, elo);
  }

  /**
   * Add a multiple choice card.
   */
  addMultipleChoiceCard(
    question: string,
    options: string[],
    correctIndex: number,
    tags: string[] = [],
    elo?: number
  ): this {
    return this.addCard(
      'multipleChoice',
      { question, options, correctIndex },
      tags,
      elo
    );
  }

  /**
   * Add a basic flashcard (front/back).
   */
  addFlashcard(front: string, back: string, tags: string[] = [], elo?: number): this {
    return this.addCard('basicCard', { front, back }, tags, elo);
  }

  /**
   * Add a hierarchy definition strategy.
   *
   * @param name - Strategy name
   * @param levels - Tag names representing hierarchy levels
   * @param unlockThreshold - Mastery threshold to unlock next level (0-1)
   */
  addHierarchyStrategy(
    name: string,
    levels: string[],
    unlockThreshold = 0.8
  ): this {
    this.strategies.push({
      name,
      implementingClass: 'hierarchyDefinition',
      description: `Hierarchy strategy: ${levels.join(' → ')}`,
      serializedData: JSON.stringify({ levels, unlockThreshold }),
    });
    return this;
  }

  /**
   * Add an ELO selection strategy.
   *
   * @param name - Strategy name
   * @param options - ELO strategy options
   */
  addEloStrategy(
    name: string,
    options?: {
      targetRange?: number;
      priorityMultiplier?: number;
    }
  ): this {
    this.strategies.push({
      name,
      implementingClass: 'elo',
      description: `ELO-based card selection`,
      serializedData: options ? JSON.stringify(options) : undefined,
    });
    return this;
  }

  /**
   * Add an SRS scheduling strategy.
   *
   * @param name - Strategy name
   * @param options - SRS strategy options
   */
  addSrsStrategy(
    name: string,
    options?: {
      overdueWeight?: number;
      intervalWeight?: number;
    }
  ): this {
    this.strategies.push({
      name,
      implementingClass: 'srs',
      description: `Spaced repetition scheduling`,
      serializedData: options ? JSON.stringify(options) : undefined,
    });
    return this;
  }

  /**
   * Add an interference filter strategy.
   *
   * @param name - Strategy name
   * @param options - Interference options
   */
  addInterferenceFilter(
    name: string,
    options?: {
      similarityThreshold?: number;
      recentCardWindow?: number;
    }
  ): this {
    this.strategies.push({
      name,
      implementingClass: 'interferenceFilter',
      description: `Reduce similar card interference`,
      serializedData: options ? JSON.stringify(options) : undefined,
    });
    return this;
  }

  /**
   * Add a relative priority filter strategy.
   *
   * @param name - Strategy name
   * @param tagPriorities - Map of tag to priority multiplier
   */
  addRelativePriorityFilter(
    name: string,
    tagPriorities: Record<string, number>
  ): this {
    this.strategies.push({
      name,
      implementingClass: 'relativePriority',
      description: `Tag-based priority filtering`,
      serializedData: JSON.stringify({ tagPriorities }),
    });
    return this;
  }

  /**
   * Add a custom strategy.
   */
  addStrategy(strategy: StrategyDefinition): this {
    this.strategies.push(strategy);
    return this;
  }

  /**
   * Get the number of cards queued for building.
   */
  getCardCount(): number {
    return this.cards.length;
  }

  /**
   * Get the number of strategies queued for building.
   */
  getStrategyCount(): number {
    return this.strategies.length;
  }

  /**
   * Build the course by creating all cards and strategies.
   *
   * @param courseDB - Course database to populate
   * @returns Created card and strategy IDs
   */
  async build(courseDB: TestCourseDB): Promise<CourseBuilderResult> {
    const cardIds: string[] = [];
    const strategyIds: string[] = [];
    const cardIdsByTag = new Map<string, string[]>();

    // Create all cards
    for (const card of this.cards) {
      const id = await courseDB.addCard({
        shape: card.shape,
        data: card.data,
        tags: card.tags,
        elo: card.elo,
      });
      cardIds.push(id);

      // Track cards by tag
      for (const tag of card.tags) {
        const existing = cardIdsByTag.get(tag) || [];
        existing.push(id);
        cardIdsByTag.set(tag, existing);
      }
    }

    // Create all strategies
    for (const strategy of this.strategies) {
      const id = await courseDB.addNavigationStrategy({
        name: strategy.name,
        implementingClass: strategy.implementingClass,
        description: strategy.description || `Strategy: ${strategy.name}`,
        serializedData: strategy.serializedData,
      });
      strategyIds.push(id);
    }

    return { cardIds, strategyIds, cardIdsByTag };
  }

  /**
   * Clear all queued cards and strategies.
   */
  reset(): this {
    this.cards = [];
    this.strategies = [];
    return this;
  }
}

/**
 * Factory function to create a new CourseBuilder.
 */
export function createCourseBuilder(): CourseBuilder {
  return new CourseBuilder();
}