import { CourseWare } from '../CourseWare';
import { EchoQuestion } from './questions/echo';
import { PlayNote } from './questions/playNote';

const piano: CourseWare = new CourseWare('piano', [EchoQuestion, PlayNote]);

export default piano;
