import { Question } from '@vue-skuilder/common-ui';
import {
  FieldDefinition,
  Answer,
  ViewData,
  DataShapeName,
  FieldType,
  Status,
} from '@vue-skuilder/common';
import MultiplicationHorizontal from './blorizontal.vue';
import VerbalMultiplication from './verbal.vue';

const validator = {
  instructions: 'An integer between 0 and 10, inclusive.',
  test: (value: string) => {
    const input = parseInt(value, 10);
    if (0 <= input && input <= 10) {
      return {
        status: Status.ok,
        msg: '',
      };
    } else {
      return {
        status: Status.error,
        msg: 'Single digit multiplication problem inputs must be between 0 and 10, inclusive.',
      };
    }
  },
};

const fields: FieldDefinition[] = [
  {
    name: 'a',
    type: FieldType.INT,
    validator,
  },
  {
    name: 'b',
    type: FieldType.INT,
    validator,
  },
];

export class SingleDigitMultiplicationQuestion extends Question {
  public static dataShapes = [
    {
      name: DataShapeName.MATH_SingleDigitMultiplication,
      fields,
    },
  ];

  public static views = [VerbalMultiplication, MultiplicationHorizontal];

  public a: number;
  public b: number;

  constructor(data: ViewData[]) {
    super(data);
    this.a = data[0].a as number;
    this.b = data[0].b as number;
  }

  public isCorrect(answer: Answer) {
    return this.a * this.b === answer;
  }

  public dataShapes() {
    return SingleDigitMultiplicationQuestion.dataShapes;
  }

  public views() {
    return SingleDigitMultiplicationQuestion.views;
  }
}
