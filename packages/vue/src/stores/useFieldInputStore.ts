import { DataShape } from '@/base-course/Interfaces/DataShape';
import { fieldConverters, FieldType } from '@/enums/FieldType';
import { Status } from '@vue-skuilder/common';
import { defineStore } from 'pinia';

export interface MediaInputs {
  [key: `audio-${number}`]: unknown;
  [key: `image-${number}`]: unknown;
}

export interface FieldInputStore {
  // [key: string]: unknown;

  // // Raw field values by field name
  //
  //

  /**
   * The
   */
  dataShape: DataShape | null;

  /**
   * Raw input field values by field name - the user-edited submissions
   */
  inputs: Record<string, unknown>;

  /**
   * additions from the MediaDragDrop editor.
   */
  mediaInputs: MediaInputs;

  inputIsValid: boolean;

  /**
   * Validation status of each field - all must be true for the form to be valid and the data to be submissable
   */
  validation: Record<string, boolean>;
  /**
   * Input prepared for sending to the database
   */
  convertedInput: Record<string, unknown>;
  /**
   * Input prepared for local rendering in a preview
   */
  previewInput: Record<string, unknown>;

  // getFieldValue(fieldName: string): unknown;
}

export const useFieldInputStore = defineStore('fieldStore', {
  state: (): FieldInputStore => ({
    dataShape: null as DataShape | null,
    inputs: {},
    mediaInputs: {} as MediaInputs,
    inputIsValid: false,

    validation: {},
    convertedInput: {},
    previewInput: {},
  }),

  getters: {
    isValidated(): boolean {
      return this.inputIsValid;
    },

    getPreview: (state) => {
      if (state.inputIsValid) return state.previewInput;
      else return {};
    },
    getConverted: (state) => {
      if (state.inputIsValid) return state.convertedInput;
      else return {};
    },
  },

  actions: {
    $reset() {
      console.log(`[FieldInputStore].reset()`);
      this.inputs = {};
      this.mediaInputs = {};
      this.validation = {};
      this.convertedInput = {};
      this.previewInput = {};
      this.inputIsValid = false;

      // Clear all media entries
      const MAX_MEDIA_INPUTS = 10;
      for (let i = 1; i <= MAX_MEDIA_INPUTS; i++) {
        const audioKey = `audio-${i}` as keyof MediaInputs;
        const imageKey = `image-${i}` as keyof MediaInputs;

        delete this.mediaInputs[audioKey];
        delete this.mediaInputs[imageKey];
      }
    },

    setFieldValue(fieldName: string, value: unknown) {
      this.inputs[fieldName] = value;
      this.validate();
      this.convert();
    },

    setMedia(
      fieldName: keyof MediaInputs,
      media: {
        content_type: string;
        data: Blob;
      }
    ) {
      console.log(`[FieldInputStore].setMedia: ${fieldName}`);
      this.mediaInputs[fieldName] = media;
      this.convert();
    },

    validate() {
      this.validation = {};

      if (this.dataShape === null) {
        this.inputIsValid = false;
        return;
      }

      this.inputIsValid = true;

      for (const field of this.dataShape.fields) {
        if (field.validator) {
          const result = field.validator.test(this.inputs[field.name] as unknown as string);
          if (result.status === Status.ok) {
            this.validation[field.name] = true;
          } else {
            this.inputIsValid = false;
            this.validation[field.name] = false;
          }
        }
      }
    },

    convert() {
      this.convertedInput = {};

      this.dataShape?.fields.forEach((f) => {
        this.convertedInput[f.name] = fieldConverters[f.type].databaseConverter(
          this.inputs[f.name]
        );
        this.previewInput[f.name] = fieldConverters[f.type].previewConverter(this.inputs[f.name]);
      });

      // Check for media entries
      for (let i = 1; i < 11; i++) {
        const index = `audio-${i}` as keyof MediaInputs;
        const value = this.mediaInputs[index];
        if (value) {
          this.convertedInput[index] = fieldConverters[FieldType.AUDIO].databaseConverter(value);
          this.previewInput[index] = fieldConverters[FieldType.AUDIO].previewConverter(value);
        } else {
          break;
        }
      }

      for (let i = 1; i < 11; i++) {
        const index = `image-${i}` as keyof MediaInputs;
        const value = this.mediaInputs[index];
        if (value) {
          this.convertedInput[index] = fieldConverters[FieldType.IMAGE].databaseConverter(value);
          this.previewInput[index] = fieldConverters[FieldType.IMAGE].previewConverter(value);
        } else {
          break;
        }
      }
    },

    clearMediaEntries() {
      // Clear all media entries up to a reasonable limit
      for (let i = 1; i <= 10; i++) {
        delete this.mediaInputs[`audio-${i}`];
        delete this.mediaInputs[`image-${i}`];
        delete this.convertedInput[`audio-${i}`];
        delete this.convertedInput[`image-${i}`];
        delete this.previewInput[`audio-${i}`];
        delete this.previewInput[`image-${i}`];
      }
    },

    clearField(fieldName: string) {
      delete this.inputs[fieldName];
      delete this.validation[fieldName];
      delete this.convertedInput[fieldName];
      delete this.previewInput[fieldName];
    },
  },
});
