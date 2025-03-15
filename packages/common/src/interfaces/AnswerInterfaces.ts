// eslint-disable-next-line
export interface Answer {}

export interface RadioMultipleChoiceAnswer extends Answer {
  choiceList: string[];
  selection: number;
}
