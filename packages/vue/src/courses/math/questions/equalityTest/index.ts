import { Question } from '@vue-skuilder/common-ui';
import { FieldDefinition, Answer } from '@vue-skuilder/common';
import { ViewData } from '@vue-skuilder/common';
import { DataShapeName } from '@vue-skuilder/common';
import { FieldType } from '@vue-skuilder/common';
import TrueFalse from './trueFalse.vue';

const fields: FieldDefinition[] = [
  {
    name: 'a',
    type: FieldType.STRING,
  },
  {
    name: 'b',
    type: FieldType.STRING,
  },
];

export class EqualityTest extends Question {
  public static dataShapes = [
    {
      name: DataShapeName.MATH_EqualityTest,
      fields,
    },
  ];

  public static views = [TrueFalse];

  public a: string; // vueComponent / "MathJax expression" or something
  public b: string;

  /**
   * @param data a and b are seed props that will pop a question of
   * the form [(a*b) / b = ___]. So, b must be non-zero.
   */
  constructor(data: ViewData[]) {
    super(data);
    this.a = data[0].a as string;
    this.b = data[0].b as string;
  }

  public isCorrect(answer: Answer) {
    return (this.a === this.b) === answer;
  }

  public dataShapes() {
    return EqualityTest.dataShapes;
  }

  public views() {
    return EqualityTest.views;
  }
}
