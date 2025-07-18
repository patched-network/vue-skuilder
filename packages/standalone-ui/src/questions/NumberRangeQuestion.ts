import { ViewData, Answer, Question } from '@vue-skuilder/courseware';
import { FieldType, DataShape, DataShapeName } from '@vue-skuilder/common';
import NumberRangeQuestionView from './NumberRangeQuestionView.vue';

export class NumberRangeQuestion extends Question {
  public static dataShapes: DataShape[] = [
    {
      name: 'NumberRangeQuestion' as DataShapeName,
      fields: [
        { name: 'questionText', type: FieldType.STRING },
        { name: 'min', type: FieldType.NUMBER },
        { name: 'max', type: FieldType.NUMBER },
      ],
    },
  ];

  public static views = [{ name: 'NumberRangeQuestionView', component: NumberRangeQuestionView }];

  // @ts-expect-error TS6133: Used in Vue template
  private questionText: string;
  private min: number;
  private max: number;

  constructor(data: ViewData[]) {
    super(data);
    this.questionText = data[0].questionText as string;
    this.min = data[0].min as number;
    this.max = data[0].max as number;
  }

  public dataShapes(): DataShape[] {
    return NumberRangeQuestion.dataShapes;
  }

  public views() {
    // This will be dynamically populated or imported
    return NumberRangeQuestion.views;
  }

  protected isCorrect(answer: Answer): boolean {
    const userAnswer = answer.response as number;
    return userAnswer >= this.min && userAnswer <= this.max;
  }
}
