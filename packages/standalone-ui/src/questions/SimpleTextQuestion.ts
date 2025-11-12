import { ViewData, Answer, Question } from '@vue-skuilder/courseware';
import { FieldType, DataShape, DataShapeName } from '@vue-skuilder/common';
import { markRaw } from 'vue';
import SimpleTextQuestionView from './SimpleTextQuestionView.vue';

export class SimpleTextQuestion extends Question {
  public static dataShapes: DataShape[] = [
    {
      name: 'SimpleTextQuestion' as DataShapeName,
      fields: [
        { name: 'questionText', type: FieldType.STRING },
        { name: 'correctAnswer', type: FieldType.STRING },
      ],
    },
  ];

  public static views = [markRaw(SimpleTextQuestionView)];

  // @ts-expect-error TS6133: Used in Vue template
  private questionText: string;
  private correctAnswer: string;

  constructor(data: ViewData[]) {
    super(data);
    this.questionText = data[0].questionText as string;
    this.correctAnswer = data[0].correctAnswer as string;
  }

  public dataShapes(): DataShape[] {
    return SimpleTextQuestion.dataShapes;
  }

  public views() {
    // This will be dynamically populated or imported
    return SimpleTextQuestion.views;
  }

  protected isCorrect(answer: Answer): boolean {
    return (answer.response as string).toLowerCase() === this.correctAnswer.toLowerCase();
  }
}
