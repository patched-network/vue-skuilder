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

interface FieldConverter {
  databaseConverter: Converter;
  previewConverter: Converter;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Converter = (value: any) => string | number | boolean | Blob;
