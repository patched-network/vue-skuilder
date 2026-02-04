import { DisplayableData, DocType } from './db.js';
import { NameSpacer } from './namespacer.js';
import { DataShape } from './interfaces/DataShape.js';
import { FieldDefinition } from './interfaces/FieldDefinition.js';

import { FieldType } from './enums/FieldType.js';

export function prepareNote55(
  courseID: string,
  codeCourse: string,
  shape: DataShape,
  // [ ] add typing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  author: string,
  _tags: string[],
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

export interface Evaluation {
  isCorrect: boolean; // expand / contract the SRS
  performance: Performance;
}

/**
 * Performance can be a simple number (0-1) for overall score,
 * or a structured object with per-tag granularity.
 */
export type Performance = number | TaggedPerformance;

/**
 * Structured performance with per-tag scoring.
 *
 * Questions that exercise multiple skills (e.g., spelling with multiple GPCs)
 * can provide individual scores per tag for granular ELO updates.
 *
 * @example
 * // Spelling "cat" as "kat" - got 'a' and 't' right, but 'c' wrong
 * {
 *   _global: 0.67,      // 2/3 correct, used for SRS and global ELO
 *   'GPC-c-K': 0,       // incorrect
 *   'GPC-a-AE': 1,      // correct
 *   'GPC-t-T': 1,       // correct
 * }
 */
export interface TaggedPerformance {
  /**
   * Overall score for SRS scheduling and global ELO updates.
   * Required when using structured performance.
   * Range: [0, 1]
   */
  _global: number;

  /**
   * Per-tag scores. Keys are tag IDs (e.g., 'GPC-c-K').
   * Tags not present on the card will be created dynamically.
   * Range: [0, 1] for each value.
   */
  [tag: string]: number;
}

/**
 * Type guard to check if performance is structured (TaggedPerformance).
 */
export function isTaggedPerformance(p: Performance): p is TaggedPerformance {
  return typeof p === 'object' && p !== null && '_global' in p;
}
