import { Validator } from './Validator.js';
import { Tagger } from './Tagger.js';
import { FieldType } from '../enums/FieldType.js';
import { CourseElo } from '../elo.js';
export interface FieldDefinition {
  name: string;
  type: FieldType;
  validator?: Validator;
  tagger?: Tagger;
  generateELO?: (x: any) => CourseElo;
}
