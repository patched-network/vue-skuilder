import { CourseWare } from '@vue-skuilder/courseware';
import { SimpleTextQuestion } from './SimpleTextQuestion';
import { MultipleChoiceQuestion } from './MultipleChoiceQuestion';
import { NumberRangeQuestion } from './NumberRangeQuestion';

export const exampleCourse = new CourseWare('ExampleCourse', [
  SimpleTextQuestion,
  MultipleChoiceQuestion,
  NumberRangeQuestion,
]);
