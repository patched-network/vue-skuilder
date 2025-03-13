import { FieldType } from './enums/FieldType.js';

const numberConverter: Converter = (value: string) => {
  return parseFloat(value);
};
const intConverter: Converter = (value: string) => {
  return parseInt(value, 10);
};

export const fieldConverters: { [index in FieldType]: FieldConverter } = {
  string: {
    databaseConverter: (value: string) => value,
    previewConverter: (value: string) => value,
  },
  chess_puzzle: {
    databaseConverter: (value: string) => value,
    previewConverter: (value: string) => value,
  },
  number: {
    databaseConverter: numberConverter,
    previewConverter: numberConverter,
  },
  int: {
    databaseConverter: intConverter,
    previewConverter: intConverter,
  },
  image: {
    databaseConverter: (value) => value,
    previewConverter: (value: { content_type: string; data: Blob }) => {
      if (value) {
        return value.data;
      } else {
        return new Blob();
      }
    },
  },
  audio: {
    databaseConverter: (value) => value,
    previewConverter: (value: { content_type: string; data: Blob }) => {
      if (value) {
        return value.data;
      } else {
        return new Blob();
      }
      // return '(audio)';
    },
  },
  midi: {
    databaseConverter: (value) => value,
    previewConverter: (value) => value,
  },
  markdown: {
    databaseConverter: (value) => value,
    previewConverter: (value) => value,
  },
  uploads: {
    databaseConverter: (value) => value,
    previewConverter: (value) => value,
  },
};

/**
 * FieldConverter contains functions to process raw user input
 * from a DataInputForm into
 *  - database-ready format (databseConverter)
 *  - render-ready format (previewConverter)
 */
interface FieldConverter {
  databaseConverter: Converter;
  previewConverter: Converter;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Converter = (value: any) => string | number | boolean | Blob;
