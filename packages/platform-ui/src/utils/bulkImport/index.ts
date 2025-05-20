// Re-export parsing utilities from common
export {
  ParsedCard,
  CardData,
  parseCard,
  parseBulkTextToCards,
  isValidBulkFormat,
  splitCardsText,
  CardParserConfig,
  CARD_DELIMITER
} from '@vue-skuilder/common';

// Re-export database utilities from db
export {
  ImportResult,
  BulkCardProcessorConfig,
  importParsedCards,
  validateProcessorConfig
} from '@vue-skuilder/db';

// Example usage for documentation purposes:
/*
import { CourseDBInterface } from '@vue-skuilder/db';
import { DataShape } from '@vue-skuilder/common';
import {
  importParsedCards,      // Renamed from processBulkCards
  validateProcessorConfig,
  parseCard,              // Still useful for single card parsing
  splitCardsText,         // Still useful for understanding delimiters or manual splitting
  isValidBulkFormat,
  parseBulkTextToCards    // New function for parsing bulk text to ParsedCard[]
} from './index'; // Assuming this index.ts correctly re-exports them

async function exampleUsage(courseDB: CourseDBInterface, dataShape: DataShape) {
  // Example bulk text
  const bulkText = `Card 1 Question
{{blank}}
tags: tagA, tagB
elo: 1500
---
---
Card 2 Question
Another {{blank}}
elo: 1200
tags: tagC`;

  // Validate config for processing
  const config = {
    dataShape,
    courseCode: 'COURSE-123',
    userName: 'user123'
  };

  const validation = validateProcessorConfig(config);
  if (!validation.isValid) {
    console.error(validation.errorMessage);
    return;
  }

  // Step 1: Parse the bulk text into an array of ParsedCard objects
  // isValidBulkFormat can be used as a preliminary check if needed
  if (!isValidBulkFormat(bulkText)) {
    console.error("Invalid bulk format");
    return;
  }
  const parsedCardsArray = parseBulkTextToCards(bulkText);

  if (parsedCardsArray.length === 0 && bulkText.trim().length > 0) {
    console.error("No cards could be parsed from the input.");
    // Potentially show an error or return if no cards were parsed,
    // even if the format had delimiters, maybe all cards were empty.
    return;
  }

  // Step 2: Process the array of parsed cards
  const results = await importParsedCards(parsedCardsArray, courseDB, config);

  // Check results
  console.log(`Attempted to import ${parsedCardsArray.length} cards.`);
  console.log(`Successfully imported: ${results.filter(r => r.status === 'success').length}`);
  console.log(`Failed: ${results.filter(r => r.status === 'error').length}`);

  // Example of parsing a single card (remains the same)
  const singleCard = `Example card with a {{blank}}
elo: 1600
tags: tag1, tag2`;
  const parsedSingle = parseCard(singleCard); // Renamed 'parsed' to 'parsedSingle' for clarity
  console.log('Parsed single card:', {
    markdown: parsedSingle?.markdown,
    tags: parsedSingle?.tags,
    elo: parsedSingle?.elo
  });
}
*/
