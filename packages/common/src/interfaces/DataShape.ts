// [ ] remove this file - duplicated in `common` package

import { FieldDefinition } from './FieldDefinition.js';
import { DataShapeName } from '../enums/DataShapeNames.js';

export interface DataShape {
  name: DataShapeName;
  fields: FieldDefinition[];
}
