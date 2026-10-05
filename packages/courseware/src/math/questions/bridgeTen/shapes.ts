import { DataShape, FieldType, DataShapeName } from '@vue-skuilder/common';

export const BridgeTenDataShape: DataShape = {
  name: DataShapeName.MATH_BridgeTen,
  fields: [
    { name: 'a', type: FieldType.INT },
    { name: 'b', type: FieldType.INT },
  ],
};
