import { Question, ViewData, Answer } from '@vue-skuilder/courses';
import { FieldType, DataShape } from '@vue-skuilder/common';
import MultipleChoiceQuestionView from './MultipleChoiceQuestionView.vue';

export class MultipleChoiceQuestion extends Question {
  public static dataShapes: DataShape[] = [
    {
      name: 'MultipleChoiceQuestion',
      fields: [
        { name: 'questionText', type: FieldType.STRING },
        { name: 'options', type: FieldType.STRING }, // Comma-separated string of options
        { name: 'correctAnswer', type: FieldType.STRING },
      ],
    },
  ];

  public static views = [
    { name: 'MultipleChoiceQuestionView', component: MultipleChoiceQuestionView },
  ];

  private questionText: string;
  private options: string[];
  private correctAnswer: string;

  constructor(data: ViewData[]) {
    super(data);
    this.questionText = data[0].questionText as string;
    this.options = (data[0].options as string).split(',').map(s => s.trim());
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
