// [ ] remove this file - duplicated in `common` package

import { FieldDefinition } from '../../base-course/Interfaces/FieldDefinition';
import { DataShapeName } from '../../enums/DataShapeNames';

export interface DataShape {
  name: DataShapeName;
  fields: FieldDefinition[];
}
