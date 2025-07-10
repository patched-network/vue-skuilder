import { Course } from '@vue-skuilder/courses';
import { SimpleTextQuestion } from './SimpleTextQuestion';
import { MultipleChoiceQuestion } from './MultipleChoiceQuestion';
import { NumberRangeQuestion } from './NumberRangeQuestion';

export const exampleCourse = new Course('ExampleCourse', [
  new SimpleTextQuestion([
    { questionText: 'What is the capital of France?', correctAnswer: 'Paris' },
  ]),
  new SimpleTextQuestion([
    { questionText: 'What is 2 + 2?', correctAnswer: '4' },
  ]),
  new MultipleChoiceQuestion([
    { questionText: 'Which of these is a fruit?', options: 'Apple,Carrot,Potato', correctAnswer: 'Apple' },
  ]),
  new NumberRangeQuestion([
    { questionText: 'Enter a number between 5 and 10', min: 5, max: 10 },
  ]),
]);