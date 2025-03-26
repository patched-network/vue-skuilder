import { Answer } from '@vue-skuilder/common';

export interface RadioMultipleChoiceAnswer extends Answer {
  choiceList: string[];
  selection: number;
}
