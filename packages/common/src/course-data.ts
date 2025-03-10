import { Status } from './wire-format.js';
import { DisplayableData, DocType } from './db.js';
import { NameSpacer } from './namespacer.js';
import { CourseElo } from './elo.js';

export interface DataShape {
  name: DataShapeName;
  fields: FieldDefinition[];
}

export interface ValidationResult {
  status: Status;
  msg: string;
}

export type ValidatingFunction = (value: string) => ValidationResult;

export interface Validator {
  instructions?: string;
  placeholder?: string;
  test: ValidatingFunction;
}

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

export interface Tagger {
  (x: any): string[];
}

export interface FieldDefinition {
  name: string;
  type: FieldType;
  validator?: Validator;
  tagger?: Tagger;
  generateELO?: (x: any) => CourseElo;
}

export enum DataShapeName {
  BLANK = '',
  // Shared base-course types
  Basic = 'Basic',
  Blanks = 'Blanks',
  Default = 'Default',

  // Math
  MATH_SingleDigitAddition = 'SingleDigitAddition',
  MATH_SingleDigitSubtraction = 'SingleDigitSubtraction',
  MATH_SingleDigitDivision = 'SingleDigitDivision',
  MATH_SingleDigitMultiplication = 'SingleDigitMultiplication',
  MATH_EqualityTest = 'EqualityTest',
  MATH_OneStepEquation = 'OneStepEquation',
  MATH_AngleCategorize = 'AngleCategorize',
  MATH_SupplimentaryAngles = 'SupplimentaryAngles',
  MATH_CountBy = 'CountBy',

  // French
  FRENCH_AudioParse = 'AudioParse',
  FRENCH_Vocab = 'Vocab',

  // WordWork
  WORDWORK_Spelling = 'WordWork_Spelling',

  // Piano
  PIANO_Echo = 'Piano_Echo',
  PIANO_PlayNote = 'Piano_PlayNote',

  // Pitch
  PITCH_chroma = 'Pitch_chroma',

  // SightSing
  SIGHTSING_IdentifyKey = 'SightSing_IdentifyKey',

  // Chess
  CHESS_puzzle = 'CHESS_puzzle',
  CHESS_forks = 'CHESS_forks',

  // Typing
  TYPING_singleLetter = 'TYPING_singleLetter',
  TYPING_fallingLetters = 'TYPING_fallingLetters',
}

export function prepareNote55(
  courseID: string,
  codeCourse: string,
  shape: DataShape,
  // [ ] add typing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  author: string,
  tags: string[],
  uploads?: { [x: string]: PouchDB.Core.FullAttachment }
): DisplayableData {
  const dataShapeId = NameSpacer.getDataShapeString({
    course: codeCourse,
    dataShape: shape.name,
  });

  const attachmentFields = shape.fields
    .map((field) => {
      // make a copy, in order NOT to append to the datashape
      const copy: FieldDefinition = {
        name: field.name,
        type: field.type,
      };
      return copy;
    })
    .filter((field) => {
      return field.type === FieldType.IMAGE || field.type === FieldType.AUDIO;
    })
    .concat([
      {
        name: 'autoplayAudio',
        type: FieldType.AUDIO,
      },
    ]);

  for (let i = 1; i < 11; i++) {
    if (data[`audio-${i}`]) {
      attachmentFields.push({
        name: `audio-${i}`,
        type: FieldType.AUDIO,
      });
    }

    if (data[`image-${i}`]) {
      attachmentFields.push({
        name: `image-${i}`,
        type: FieldType.IMAGE,
      });
    }
  }
  if (data[`audio-11`]) {
    throw new Error('Too many audio attachments');
  }
  if (data[`image-11`]) {
    throw new Error('Too many image attachments');
  }

  const attachments: { [index: string]: PouchDB.Core.FullAttachment } = {};
  const payload: DisplayableData = {
    course: courseID,
    data: [],
    docType: DocType.DISPLAYABLE_DATA,
    id_datashape: dataShapeId,
  };

  if (author) {
    payload.author = author;
  }

  attachmentFields.forEach((attField) => {
    attachments[attField.name] = data[attField.name];
  });

  //
  if (uploads) {
    Object.keys(uploads).forEach((k) => {
      attachments[k] = uploads[k];
    });
  }

  if (attachmentFields.length !== 0 || (uploads && Object.keys(uploads).length)) {
    payload._attachments = attachments;
  }

  shape.fields
    .filter((field) => {
      return field.type !== FieldType.IMAGE && field.type !== FieldType.AUDIO;
    })
    .forEach((field) => {
      payload.data.push({
        name: field.name,
        data: data[field.name],
      });
    });

  return payload;
}

/**
 * Question components
 */

export interface Answer {}

export interface Evaluation {
  isCorrect: boolean; // expand / contract the SRS
  performance: Performance;
}

type Performance =
  | number
  | {
      [dimension: string]: Performance;
    };
