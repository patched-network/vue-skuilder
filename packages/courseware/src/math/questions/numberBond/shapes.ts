import { DataShape, FieldType, DataShapeName } from '@vue-skuilder/common';

export const NumberBondDataShape: DataShape = {
  name: DataShapeName.MATH_NumberBond,
  fields: [
    { name: 'whole', type: FieldType.INT },
    { name: 'part', type: FieldType.INT },
  ],
};
