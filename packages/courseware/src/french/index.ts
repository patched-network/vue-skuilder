import { CourseWare } from '../CourseWare';
import { AudioParsingQuestion } from './questions/audioparse';
import { VocabQuestion } from './questions/vocab';

const french: CourseWare = new CourseWare('french', [AudioParsingQuestion, VocabQuestion]);

export default french;
