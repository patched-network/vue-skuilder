// Prompts registry and exports
export * from './fill-in-card-authoring.js';
export * from './elo-scoring-guidance.js';

// Prompt patterns
export const PROMPT_PATTERNS = {
  FILL_IN_CARD_AUTHORING: 'fill-in-card-authoring',
  ELO_SCORING_GUIDANCE: 'elo-scoring-guidance',
} as const;
