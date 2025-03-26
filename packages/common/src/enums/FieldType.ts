/**
 * These are the defined types of user input that can hydrate a configured
 * dataShape.
 *
 * These field types map to input elements and specific validation and processing functions.
 */
export enum FieldType {
  STRING = 'string',
  NUMBER = 'number',
  INT = 'int',
  IMAGE = 'image',
  MARKDOWN = 'markdown',
  AUDIO = 'audio',
  MIDI = 'midi',
  MEDIA_UPLOADS = 'uploads',
  CHESS_PUZZLE = 'chess_puzzle',
}
