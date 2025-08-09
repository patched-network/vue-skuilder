import { DataShape, FieldType, DataShapeName } from '@vue-skuilder/common';

export const EqualityTestDataShape: DataShape = {
  name: DataShapeName.MATH_EqualityTest,
  fields: [
    { name: 'a', type: FieldType.STRING },
    { name: 'b', type: FieldType.STRING },
  ],
};