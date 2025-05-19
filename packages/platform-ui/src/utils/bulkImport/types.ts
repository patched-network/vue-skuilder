import { DataShape } from '@vue-skuilder/common';

/**
 * Interface representing the result of a bulk import operation for a single card
 */
export interface ImportResult {
  /** The original text input for the card */
  originalText: string;
  /** Status of the import operation */
  status: 'success' | 'error';
  /** Message describing the result or error */
  message: string;
  /** ID of the newly created card (only for success) */
  cardId?: string;
}

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
export interface CardData {
  /** Card markdown content */
  Input: string;
  /** Card media uploads */
  Uploads: any[];
  /** Any additional fields can be added as needed */
  [key: string]: any;
}

/**
 * Configuration for the bulk card processor
 */
export interface BulkCardProcessorConfig {
  /** The data shape to use for the cards */
  dataShape: DataShape;
  /** The course code used for adding notes */
  courseCode: string;
  /** The username of the current user */
  userName: string;
}