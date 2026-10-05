import { DataShape, FieldType, DataShapeName } from '@vue-skuilder/common';

export const DecadeFactDataShape: DataShape = {
  name: DataShapeName.MATH_DecadeFact,
  fields: [
    { name: 'a', type: FieldType.INT },
    { name: 'b', type: FieldType.INT },
    { name: 'op', type: FieldType.STRING },
  ],
};
