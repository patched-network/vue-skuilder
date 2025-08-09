import { DataShape, FieldType, DataShapeName } from '@vue-skuilder/common';

export const SingleDigitAdditionDataShape: DataShape = {
  name: DataShapeName.MATH_SingleDigitAddition,
  fields: [
    { name: 'a', type: FieldType.INT },
    { name: 'b', type: FieldType.INT },
  ],
};