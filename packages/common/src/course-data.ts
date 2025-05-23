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

type Performance =
  | number
  | {
      [dimension: string]: Performance;
    };
