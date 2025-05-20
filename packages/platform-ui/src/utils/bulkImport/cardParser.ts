import { ParsedCard } from './types';

/**
 * Configuration for the bulk card parser
 */
export interface CardParserConfig {
  /** Custom tag identifier (defaults to 'tags:') */
  tagIdentifier?: string;
  /** Custom ELO identifier (defaults to 'elo:') */
  eloIdentifier?: string;
}

/**
 * Default configuration for the card parser
 */
const DEFAULT_PARSER_CONFIG: CardParserConfig = {
  tagIdentifier: 'tags:',
  eloIdentifier: 'elo:',
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
  let elo: number | undefined = undefined;
  const markdownLines = [...lines];
  
  // Process the lines from bottom to top to handle metadata
  let metadataLines = 0;
  
  // Get the configured identifiers
  const tagId = config.tagIdentifier || DEFAULT_PARSER_CONFIG.tagIdentifier;
  const eloId = config.eloIdentifier || DEFAULT_PARSER_CONFIG.eloIdentifier;
  
  // Check the last few lines for metadata (tags and elo)
  for (let i = lines.length - 1; i >= 0 && i >= lines.length - 2; i--) {
    const line = lines[i].trim();
    
    // Check for tags
    if (line.toLowerCase().startsWith(tagId!.toLowerCase())) {
      tags = line
        .substring(tagId!.length)
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag);
      metadataLines++;
    }
    // Check for ELO
    else if (line.toLowerCase().startsWith(eloId!.toLowerCase())) {
      const eloValue = line.substring(eloId!.length).trim();
      const parsedElo = parseInt(eloValue, 10);
      if (!isNaN(parsedElo)) {
        elo = parsedElo;
      }
      metadataLines++;
    }
  }
  
  // Remove metadata lines from the end of the content
  if (metadataLines > 0) {
    markdownLines.splice(markdownLines.length - metadataLines);
  }

  const markdown = markdownLines.join('\n').trim();
  if (!markdown) {
    // Card must have some markdown content
    return null;
  }
  
  return { markdown, tags, elo };
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
 * Parses a bulk text input into an array of structured ParsedCard objects.
 *
 * @param bulkText - Raw string containing multiple cards.
 * @param config - Optional parser configuration.
 * @returns Array of ParsedCard objects. Filters out cards that fail to parse.
 */
export function parseBulkTextToCards(bulkText: string, config: CardParserConfig = DEFAULT_PARSER_CONFIG): ParsedCard[] {
  const cardStrings = splitCardsText(bulkText);
  const parsedCards: ParsedCard[] = [];

  for (const cardString of cardStrings) {
    const parsedCard = parseCard(cardString, config);
    if (parsedCard) {
      parsedCards.push(parsedCard);
    }
  }
  return parsedCards;
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