import { defineStore } from 'pinia';
import { DataShape } from '@vue-skuilder/common';
import { CourseConfig } from '@vue-skuilder/common';
import { FieldInputInstance } from '@vue-skuilder/edit-ui';
import { useFieldInputStore } from './useFieldInputStore';
import { ViewComponent } from '@vue-skuilder/common';

interface DataInputForm {
  // current props
  dataShape: DataShape | null;
  course: CourseConfig | null;

  shapeViews: ViewComponent[];
  fields: FieldInputInstance[];

  fieldStore: ReturnType<typeof useFieldInputStore>;

  uploading: boolean;
}

export interface DataInputFormState {
  dataInputForm: DataInputForm;
}

export const useDataInputFormStore = defineStore('dataInputForm', {
  state: (): DataInputFormState => ({
    dataInputForm: {
      dataShape: null,
      course: null,
      shapeViews: [],

      fields: [],
      fieldStore: useFieldInputStore(),
      uploading: false,
    },
  }),
  // actions or getters if needed
  actions: {
    setDataShape(ds: DataShape) {
      this.dataInputForm.dataShape = ds;
      this.dataInputForm.fieldStore.dataShape = ds;
      this.dataInputForm.fieldStore.$reset();
    },
    setCourse(course: CourseConfig) {
      this.dataInputForm.course = course;
    },
    // etc. create any convenience setters or methods you wish
  },
});
