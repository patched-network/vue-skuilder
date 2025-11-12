import { ViewData, Answer, Question } from '@vue-skuilder/courseware';
import { FieldType, DataShape, DataShapeName } from '@vue-skuilder/common';
import { markRaw } from 'vue';
import MultipleChoiceQuestionView from './MultipleChoiceQuestionView.vue';

export class MultipleChoiceQuestion extends Question {
  public static dataShapes: DataShape[] = [
    {
      name: 'MultipleChoiceQuestion' as DataShapeName,
      fields: [
        { name: 'questionText', type: FieldType.STRING },
        { name: 'options', type: FieldType.STRING }, // Comma-separated string of options
        { name: 'correctAnswer', type: FieldType.STRING },
      ],
    },
  ];

  public static views = [markRaw(MultipleChoiceQuestionView)];

  // @ts-expect-error TS6133: Used in Vue template
  private _questionText: string;
  // @ts-expect-error TS6133: Used in Vue template
  private options: string[];
  private correctAnswer: string;

  constructor(data: ViewData[]) {
    super(data);
    this._questionText = data[0].questionText as string;
    this.options = (data[0].options as string).split(',').map((s) => s.trim());
    this.correctAnswer = data[0].correctAnswer as string;
  }

  public dataShapes(): DataShape[] {
    return MultipleChoiceQuestion.dataShapes;
  }

  public views() {
    // This will be dynamically populated or imported
    return MultipleChoiceQuestion.views;
  }

  protected isCorrect(answer: Answer): boolean {
    return (answer.response as string) === this.correctAnswer;
  }
}
