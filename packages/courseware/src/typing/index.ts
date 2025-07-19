// vue/src/courses/typing/index.ts
import { CourseWare } from '../CourseWare';
import { TypeLetterQuestion } from './questions/single-letter';
import { FallingLettersQuestion } from './questions/falling-letters';

const typing: CourseWare = new CourseWare('typing', [TypeLetterQuestion, FallingLettersQuestion]);

export default typing;
