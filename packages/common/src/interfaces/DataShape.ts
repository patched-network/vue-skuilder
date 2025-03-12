// [ ] remove this file - duplicated in `common` package

import { FieldDefinition } from './FieldDefinition.js';
import { DataShapeName } from '../course-data.js';

export interface DataShape {
  name: DataShapeName;
  fields: FieldDefinition[];
}
