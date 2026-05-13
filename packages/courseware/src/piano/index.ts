import { CourseWare } from '../CourseWare';
import { EchoQuestion } from './questions/echo';
import { NotationMCQuestion } from './questions/notationMC';
import { PlayNote } from './questions/playNote';

const piano: CourseWare = new CourseWare('piano', [EchoQuestion, NotationMCQuestion, PlayNote]);

export default piano;
