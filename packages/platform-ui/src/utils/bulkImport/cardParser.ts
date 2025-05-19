import { ParsedCard } from './types';

/**
 * Configuration for the bulk card parser
 */
export interface CardParserConfig {
  /** Custom tag identifier (defaults to 'tags:') */
  tagIdentifier?: string;
}

/**
 * Default configuration for the card parser
 */
const DEFAULT_PARSER_CONFIG: CardParserConfig = {
  tagIdentifier: 'tags:',
};

/**
 * Card delimiter used to separate cards in bulk input
 */
export const CARD_DELIMITER = '\n---\n---\n';

/**
 * Parses a single card string into a structured object
 * 
 * @param cardString - Raw string containing card content
 * @param config - Optional parser configuration
 * @returns ParsedCard object or null if parsing fails
 */
export function parseCard(cardString: string, config: CardParserConfig = DEFAULT_PARSER_CONFIG): ParsedCard | null {
  const trimmedCardString = cardString.trim();
  if (!trimmedCardString) {
    return null;
  }

  const lines = trimmedCardString.split('\n');
  let tags: string[] = [];
  const markdownLines = [...lines];

  if (lines.length > 0) {
    const lastLine = lines[lines.length - 1].trim();
    const tagId = config.tagIdentifier || DEFAULT_PARSER_CONFIG.tagIdentifier;
    
    if (lastLine.toLowerCase().startsWith(tagId!.toLowerCase())) {
      tags = lastLine
        .substring(tagId!.length)
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag);
      markdownLines.pop(); // Remove the tags line
    }
  }

  const markdown = markdownLines.join('\n').trim();
  if (!markdown) {
    // Card must have some markdown content
    return null;
  }
  
  return { markdown, tags };
}

/**
 * Splits a bulk text input into individual card strings
 * 
 * @param bulkText - Raw string containing multiple cards
 * @returns Array of card strings
 */
export function splitCardsText(bulkText: string): string[] {
  return bulkText.split(CARD_DELIMITER)
    .map(card => card.trim())
    .filter(card => card); // Filter out empty strings
}

/**
 * Validates if a bulk text input has valid format
 * 
 * @param bulkText - Raw string containing multiple cards
 * @returns true if valid, false otherwise
 */
export function isValidBulkFormat(bulkText: string): boolean {
  const cardStrings = splitCardsText(bulkText);
  return cardStrings.length > 0 && cardStrings.some(card => !!card.trim());
}