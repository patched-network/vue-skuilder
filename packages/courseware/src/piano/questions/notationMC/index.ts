import { Question } from '@vue-skuilder/common-ui';
import { DataShape, FieldDefinition, ViewData, DataShapeName, FieldType } from '@vue-skuilder/common';
import NotationMCView from './NotationMCView.vue';

const fields: FieldDefinition[] = [
  { name: 'Correct', type: FieldType.STRING },
  { name: 'Distractors', type: FieldType.STRING },
];

export class NotationMCQuestion extends Question {
  public static dataShapes: DataShape[] = [
    {
      fields,
      name: DataShapeName.PIANO_NotationMC,
    },
  ];

  public static views = [NotationMCView];

  public correct: string;
  public distractors: string[];

  constructor(data: ViewData[]) {
    super(data);
    this.correct = data[0].Correct as string;
    this.distractors = (data[0].Distractors as string)
      .split('\n---\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  public isCorrect(answer: { selection: number; options: string[] }): boolean {
    return answer.options[answer.selection] === this.correct;
  }

  public dataShapes(): DataShape[] {
    return NotationMCQuestion.dataShapes;
  }
  public views() {
    return NotationMCQuestion.views;
  }
}
