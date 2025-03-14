import { Course } from '../Course';
import { BlanksCard } from './questions/fillIn/index';

const defaultCourse: Course = new Course('default', [BlanksCard]);

export default defaultCourse;
