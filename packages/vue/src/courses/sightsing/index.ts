import { Course } from '../Course';
import { IdentifyKeyQuestion } from './questions/IdentifyKey';
// import { SpellingQuestion } from './questions/spelling';

const sightSing: Course = new Course('sightSing', [IdentifyKeyQuestion]);

export default sightSing;
