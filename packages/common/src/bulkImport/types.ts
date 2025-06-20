// We no longer need to import DataShape since we've moved the interfaces that used it
// import { DataShape } from '@vue-skuilder/common';

/**
 * Interface representing a parsed card from bulk import
 */
export interface ParsedCard {
  /** The markdown content of the card */
  markdown: string;
  /** Tags associated with the card */
  tags: string[];
  /** ELO rating for the card (optional) */
  elo?: number;
}

/**
 * Interface for card data ready to be stored in the database
 */
export interface BulkImportCardData {
  /** Card markdown content */
  Input: string;
  /** Card media uploads */
  Uploads: unknown[];
  /** Any additional fields can be added as needed */
  [key: string]: unknown;
}

// ImportResult and BulkCardProcessorConfig have been moved to @vue-skuilder/db