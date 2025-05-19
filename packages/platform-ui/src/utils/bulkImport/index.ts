export * from './types';
export * from './cardParser';
export * from './cardProcessor';

// Example usage for documentation purposes:
/*
import { CourseDBInterface } from '@vue-skuilder/db';
import { DataShape } from '@vue-skuilder/common';
import { 
  processBulkCards, 
  validateProcessorConfig,
  parseCard,
  splitCardsText,
  isValidBulkFormat
} from './index';

async function exampleUsage(courseDB: CourseDBInterface, dataShape: DataShape) {
  // Example bulk text
  const bulkText = `Card 1 Question
{{blank}}
tags: tagA, tagB
---
---
Card 2 Question
Another {{blank}}
tags: tagC`;

  // Validate config
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
  
  // Process cards
  const results = await processBulkCards(bulkText, courseDB, config);
  
  // Check results
  console.log(`Processed ${results.length} cards`);
  console.log(`Success: ${results.filter(r => r.status === 'success').length}`);
  console.log(`Errors: ${results.filter(r => r.status === 'error').length}`);
}
*/