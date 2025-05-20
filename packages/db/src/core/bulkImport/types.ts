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
