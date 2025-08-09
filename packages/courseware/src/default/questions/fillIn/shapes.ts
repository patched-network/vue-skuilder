import { DataShape, FieldType, DataShapeName } from '@vue-skuilder/common';

export const BlanksCardDataShapes: DataShape[] = [
  {
    name: DataShapeName.Blanks,
    fields: [
      {
        name: 'Input',
        type: FieldType.MARKDOWN,
      },
      {
        name: 'Uploads',
        type: FieldType.MEDIA_UPLOADS,
      },
    ],
  },
];