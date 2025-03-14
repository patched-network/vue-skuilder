// vue/src/courses/typing/index.ts
import { Course } from '../Course';
import { TypeLetterQuestion } from './questions/single-letter';
import { FallingLettersQuestion } from './questions/falling-letters';

const typing: Course = new Course('typing', [TypeLetterQuestion, FallingLettersQuestion]);

export default typing;
