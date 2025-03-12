import { DisplayableData } from '@vue-skuilder/db';

export interface ViewData {
  [index: string]: string | number | Blob | boolean;
}

export function displayableDataToViewData(data: DisplayableData): ViewData {
  const ret: ViewData = {};
  data.data.forEach((field) => {
    ret[field.name] = field.data as string | number | boolean;
  });
  if (data._attachments) {
    Object.getOwnPropertyNames(data._attachments).forEach((attachment) => {
      // this 2nd check shouldn't be necessary, but TS is insisting
      if (data._attachments) {
        ret[attachment] = data._attachments[attachment].data as Blob;
      }
    });
  }
  return ret;
}
