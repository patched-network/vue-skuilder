/**
 * Card Templates - Common card patterns for testing.
 *
 * Pre-defined card configurations that can be used with CourseBuilder
 * for quick test setup.
 */

import { CardDefinition } from './course-builder';

// ============================================================================
// FILL-IN-THE-BLANK CARDS
// ============================================================================

/**
 * Simple fill-in card.
 */
export function fillInCard(
  prompt: string,
  answer: string,
  tags: string[] = [],
  elo?: number
): CardDefinition {
  return {
    shape: 'fillIn',
    data: { prompt, answer },
    tags,
    elo,
  };
}

/**
 * Math fill-in card.
 */
export function mathFillInCard(
  expression: string,
  answer: string,
  level: 'easy' | 'medium' | 'hard' = 'medium'
): CardDefinition {
  const eloMap = { easy: 800, medium: 1200, hard: 1600 };
  return fillInCard(
    `Evaluate: ${expression}`,
    answer,
    ['math', level],
    eloMap[level]
  );
}

/**
 * Vocabulary fill-in card.
 */
export function vocabFillInCard(
  term: string,
  definition: string,
  category: string,
  elo?: number
): CardDefinition {
  return fillInCard(
    `Define: ${term}`,
    definition,
    ['vocabulary', category],
    elo
  );
}

// ============================================================================
// MULTIPLE CHOICE CARDS
// ============================================================================

/**
 * Multiple choice card.
 */
export function multipleChoiceCard(
  question: string,
  options: string[],
  correctIndex: number,
  tags: string[] = [],
  elo?: number
): CardDefinition {
  return {
    shape: 'multipleChoice',
    data: { question, options, correctIndex },
    tags,
    elo,
  };
}

/**
 * True/False card (specialized multiple choice).
 */
export function trueFalseCard(
  statement: string,
  isTrue: boolean,
  tags: string[] = [],
  elo?: number
): CardDefinition {
  return multipleChoiceCard(
    statement,
    ['True', 'False'],
    isTrue ? 0 : 1,
    [...tags, 'true-false'],
    elo
  );
}

// ============================================================================
// BASIC FLASHCARDS
// ============================================================================

/**
 * Basic front/back flashcard.
 */
export function flashcard(
  front: string,
  back: string,
  tags: string[] = [],
  elo?: number
): CardDefinition {
  return {
    shape: 'basicCard',
    data: { front, back },
    tags,
    elo,
  };
}

/**
 * Language translation flashcard.
 */
export function translationCard(
  sourceWord: string,
  targetWord: string,
  sourceLanguage: string,
  targetLanguage: string,
  elo?: number
): CardDefinition {
  return flashcard(
    `${sourceLanguage}: ${sourceWord}`,
    `${targetLanguage}: ${targetWord}`,
    ['translation', sourceLanguage, targetLanguage],
    elo
  );
}

// ============================================================================
// CARD SETS FOR COMMON TEST SCENARIOS
// ============================================================================

/**
 * Create a set of cards with graduated ELO values.
 * Useful for testing ELO-based selection.
 */
export function eloGradientCards(
  basePrompt: string,
  count: number,
  eloRange: { min: number; max: number } = { min: 800, max: 1600 }
): CardDefinition[] {
  const cards: CardDefinition[] = [];
  const step = (eloRange.max - eloRange.min) / Math.max(count - 1, 1);

  for (let i = 0; i < count; i++) {
    const elo = Math.round(eloRange.min + step * i);
    cards.push(
      fillInCard(
        `${basePrompt} (difficulty ${i + 1})`,
        `Answer ${i + 1}`,
        [`elo-${elo}`, `difficulty-${i + 1}`],
        elo
      )
    );
  }

  return cards;
}

/**
 * Create cards for a hierarchical progression test.
 * Each level gets a specified number of cards.
 */
export function hierarchyCards(
  levels: string[],
  cardsPerLevel: number = 3
): CardDefinition[] {
  const cards: CardDefinition[] = [];
  const baseElo = 800;
  const eloPerLevel = 200;

  for (let levelIdx = 0; levelIdx < levels.length; levelIdx++) {
    const level = levels[levelIdx];
    const levelElo = baseElo + levelIdx * eloPerLevel;

    for (let cardIdx = 0; cardIdx < cardsPerLevel; cardIdx++) {
      cards.push(
        fillInCard(
          `${level} question ${cardIdx + 1}`,
          `${level} answer ${cardIdx + 1}`,
          [level, `level-${levelIdx + 1}`],
          levelElo + cardIdx * 20
        )
      );
    }
  }

  return cards;
}

/**
 * Create a set of similar cards for interference testing.
 * Cards have overlapping content that might confuse learners.
 */
export function interferenceCards(
  baseTerm: string,
  variants: string[],
  correctAnswer: string
): CardDefinition[] {
  return variants.map((variant, idx) =>
    fillInCard(
      `What is the ${variant} of ${baseTerm}?`,
      idx === 0 ? correctAnswer : `${correctAnswer}-variant-${idx}`,
      ['interference-test', baseTerm.toLowerCase()],
      1200
    )
  );
}

/**
 * Create cards with specific tags for filter testing.
 */
export function taggedCards(
  tagGroups: Record<string, number>
): CardDefinition[] {
  const cards: CardDefinition[] = [];
  let counter = 0;

  for (const [tag, count] of Object.entries(tagGroups)) {
    for (let i = 0; i < count; i++) {
      counter++;
      cards.push(
        fillInCard(
          `Question ${counter} (${tag})`,
          `Answer ${counter}`,
          [tag],
          1200
        )
      );
    }
  }

  return cards;
}

/**
 * Create a minimal set of test cards.
 */
export function minimalTestCards(): CardDefinition[] {
  return [
    fillInCard('What is 1+1?', '2', ['math', 'easy'], 800),
    fillInCard('What is 2+2?', '4', ['math', 'easy'], 900),
    fillInCard('What is 5×5?', '25', ['math', 'medium'], 1200),
  ];
}

/**
 * Create a comprehensive test deck covering multiple scenarios.
 */
export function comprehensiveTestDeck(): CardDefinition[] {
  return [
    // Easy cards
    fillInCard('Capital of France?', 'Paris', ['geography', 'easy'], 800),
    fillInCard('Capital of Germany?', 'Berlin', ['geography', 'easy'], 850),
    
    // Medium cards
    fillInCard('Capital of Australia?', 'Canberra', ['geography', 'medium'], 1100),
    fillInCard('Largest planet?', 'Jupiter', ['science', 'medium'], 1150),
    multipleChoiceCard(
      'Which element has symbol O?',
      ['Oxygen', 'Gold', 'Osmium', 'Oganesson'],
      0,
      ['science', 'medium'],
      1200
    ),
    
    // Hard cards
    fillInCard('Capital of Bhutan?', 'Thimphu', ['geography', 'hard'], 1500),
    fillInCard('Atomic number of Uranium?', '92', ['science', 'hard'], 1550),
    multipleChoiceCard(
      'Which is the smallest bone in the human body?',
      ['Stapes', 'Incus', 'Malleus', 'Femur'],
      0,
      ['science', 'hard'],
      1600
    ),
  ];
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { CardDefinition };