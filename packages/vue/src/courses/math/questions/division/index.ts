import { Question } from '../../../../base-course/Displayable';
import {
  FieldDefinition,
  Answer,
  ViewData,
  DataShapeName,
  FieldType,
  Status,
} from '@vue-skuilder/common';
import HorizontalDivision from './horizontal.vue';

const fields: FieldDefinition[] = [
  {
    name: 'a',
    type: FieldType.INT,
  },
  {
    name: 'b',
    type: FieldType.INT,
    validator: {
      instructions: 'An integer between 1 and 10, inclusive.',
      test: (value: string) => {
        const input = parseInt(value, 10);
        if (0 < input && input < 11) {
          return {
            status: Status.ok,
            msg: '',
          };
        } else if (input === 0) {
          return {
            status: Status.error,
            msg: 'Thou shalt not divide by zero.',
          };
        } else {
          return {
            status: Status.error,
            msg: 'Single digit division problem divisors must be between 1 and 10, inclusive.',
          };
        }
      },
    },
  },
];

export class SingleDigitDivisionQuestion extends Question {
  public static dataShapes = [
    {
      name: DataShapeName.MATH_SingleDigitDivision,
      fields,
    },
  ];

  public static views = [HorizontalDivision];

  public a: number;
  public b: number;

  /**
   * @param data a and b are seed props that will pop a question of
   * the form [(a*b) / b = ___]. So, b must be non-zero.
   */
  constructor(data: ViewData[]) {
    super(data);
    this.a = data[0].a as number;
    this.b = data[0].b as number;
  }

  public isCorrect(answer: Answer) {
    return this.a * this.b === answer;
  }

  public dataShapes() {
    return SingleDigitDivisionQuestion.dataShapes;
  }

  public views() {
    return SingleDigitDivisionQuestion.views;
  }
}
