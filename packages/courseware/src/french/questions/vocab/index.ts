import { Question } from '@vue-skuilder/common-ui';
import {
  Answer,
  DataShapeName,
  Validators,
  DataShape,
  FieldDefinition,
  FieldType,
} from '@vue-skuilder/common';
import IdentifyVocab from './identify.vue';

const fields: FieldDefinition[] = [
  {
    name: 'word',
    type: FieldType.STRING,
    validator: Validators.NonEmptyString,
  },
  {
    name: 'image',
    type: FieldType.IMAGE,
  },
  {
    name: 'audio',
    type: FieldType.AUDIO,
  },
];

export class VocabQuestion extends Question {
  public static dataShapes: DataShape[] = [
    {
      fields,
      name: DataShapeName.FRENCH_Vocab,
    },
  ];

  public static views = [IdentifyVocab];

  public isCorrect(answer: Answer): boolean {
    throw new Error(`isCorrect() not implemented. Cannot parse ${answer}`);
  }
  public dataShapes(): DataShape[] {
    return VocabQuestion.dataShapes;
  }
  public views() {
    return VocabQuestion.views;
  }
}
