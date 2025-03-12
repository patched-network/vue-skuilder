import { Validator } from '../../base-course/Interfaces/Validator';
import { Tagger } from '../../base-course/Interfaces/Tagger';
import { FieldType } from '../../enums/FieldType';
import { CourseElo } from '@vue-skuilder/common';

export interface FieldDefinition {
  name: string;
  type: FieldType;
  validator?: Validator;
  tagger?: Tagger;
  generateELO?: (x: any) => CourseElo;
}
