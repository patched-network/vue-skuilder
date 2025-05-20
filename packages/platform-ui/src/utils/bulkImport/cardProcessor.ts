import { CourseElo, Status } from '@vue-skuilder/common';
import { CourseDBInterface } from '@vue-skuilder/db';
import { ParsedCard, ImportResult, BulkCardProcessorConfig, CardData } from './types';

/**
 * Processes multiple cards from bulk text input
 *
 * @param courseDB - Course database interface
 * @param config - Configuration for the card processor
 * @returns Array of import results
 */
export async function importParsedCards(
  parsedCards: ParsedCard[],
  courseDB: CourseDBInterface,
  config: BulkCardProcessorConfig
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];

  for (const parsedCard of parsedCards) {
    try {
      // processCard takes a ParsedCard and returns an ImportResult
      const result = await processCard(parsedCard, courseDB, config);
      results.push(result);
    } catch (error) {
      console.error('Error processing card:', error);
      // Reconstruct originalText from parsedCard for this specific catch block
      // This is a fallback if processCard itself throws an unhandled error.
      // Normally, processCard should return an ImportResult with status 'error'.
      let errorOriginalText = parsedCard.markdown;
      if (parsedCard.tags && parsedCard.tags.length > 0) {
        errorOriginalText += `\ntags: ${parsedCard.tags.join(', ')}`;
      }
      if (parsedCard.elo !== undefined) {
        errorOriginalText += `\nelo: ${parsedCard.elo}`;
      }
      results.push({
        originalText: errorOriginalText,
        status: 'error',
        message: `Error processing card: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      });
    }
  }

  return results;
}

/**
 * Processes a single parsed card
 *
 * @param parsedCard - Parsed card data
 * @param courseDB - Course database interface
 * @param config - Configuration for the card processor
 * @returns Import result for the card
 */
async function processCard(
  parsedCard: ParsedCard,
  courseDB: CourseDBInterface,
  config: BulkCardProcessorConfig
): Promise<ImportResult> {
  const { markdown, tags, elo } = parsedCard;

  // Build the original text representation including metadata
  let originalText = markdown;
  if (tags.length > 0) {
    originalText += `\ntags: ${tags.join(', ')}`;
  }
  if (elo !== undefined) {
    originalText += `\nelo: ${elo}`;
  }

  // Create card data object
  const cardData: CardData = {
    Input: markdown,
    Uploads: [], // No uploads for bulk import
  };

  const tagsElo: CourseElo['tags'] = {};
  for (const tag of tags) {
    tagsElo[tag] = {
      score: elo || 0,
      count: 1,
    };
  }

  try {
    const result = await courseDB.addNote(
      config.courseCode,
      config.dataShape,
      cardData,
      config.userName,
      tags,
      undefined, // attachments
      elo
        ? {
            global: {
              score: elo,
              count: 1,
            },
            tags: tagsElo,
            misc: {},
          }
        : undefined
    );

    if (result.status === Status.ok) {
      return {
        originalText,
        status: 'success',
        message: 'Card added successfully.',
        cardId: result.id ? result.id : '(unknown)',
      };
    } else {
      return {
        originalText,
        status: 'error',
        message: result.message || 'Failed to add card to database. Unknown error.',
      };
    }
  } catch (error) {
    console.error('Error adding note:', error);
    return {
      originalText,
      status: 'error',
      message: `Error adding card: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Validates the configuration for bulk card processing
 *
 * @param config - Configuration to validate
 * @returns Object with validation result and error message if any
 */
export function validateProcessorConfig(config: Partial<BulkCardProcessorConfig>): {
  isValid: boolean;
  errorMessage?: string;
} {
  if (!config.dataShape) {
    return {
      isValid: false,
      errorMessage: 'No data shape provided for card processing',
    };
  }

  if (!config.courseCode) {
    return {
      isValid: false,
      errorMessage: 'No course code provided for card processing',
    };
  }

  if (!config.userName) {
    return {
      isValid: false,
      errorMessage: 'No user name provided for card processing',
    };
  }

  return { isValid: true };
}
