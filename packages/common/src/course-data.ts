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

  /**
   * When true, the framework logs the card record and updates ELO/SRS as
   * normal, but does **not** advance to the next card. The view component
   * is expected to emit a `ready-to-advance` event later to trigger
   * navigation (e.g. after an animation sequence completes).
   *
   * This allows a view to "bank" its submission early (so that replans
   * can see the updated state) while retaining control of the UI timeline.
   */
  deferAdvance?: boolean;
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
 * Tags can have scores (for exercise tags) or `null` (for count-only exposure tags).
 * Count-only tags increment their count but maintain a sentinel score of -1,
 * making them easily identifiable and preventing them from polluting real ELO data.
 *
 * @example
 * // Spelling "cat" as "kat" - got 'a' and 't' right, but 'c' wrong
 * {
 *   _global: 0.67,           // 2/3 correct, used for SRS and global ELO
 *   'gpc:exercise:c-K': 0,   // incorrect
 *   'gpc:exercise:a-AE': 1,  // correct
 *   'gpc:exercise:t-T': 1,   // correct
 * }
 *
 * @example
 * // WhoSaidThat card exercising 'sh' while exposing distractors
 * {
 *   _global: 1.0,
 *   'gpc:exercise:sh-SH': 1.0,  // exercised and correct
 *   'gpc:expose:s-S': null,     // count-only exposure (no score)
 *   'gpc:expose:ch-CH': null,   // count-only exposure (no score)
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
   * Per-tag scores or count-only markers.
   *
   * - **Number (0-1)**: Tag is exercised; score updates via ELO formula
   * - **null**: Count-only tag (e.g., exposure); increments count, score stays -1 (sentinel)
   *
   * Tags not present on the card will be created dynamically.
   * Count-only tags (null) do not update card ELO.
   */
  [tag: string]: number | null;
}

/**
 * Type guard to check if performance is structured (TaggedPerformance).
 */
export function isTaggedPerformance(p: Performance): p is TaggedPerformance {
  return typeof p === 'object' && p !== null && '_global' in p;
}
