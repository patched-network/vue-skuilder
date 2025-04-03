import { CourseElo, ValidatingFunction, ValidationResult } from '@vue-skuilder/common';
import { ComponentPublicInstance } from 'vue';

export interface FieldInputInterface {
  $refs: {
    inputField: HTMLInputElement;
  };
  validationStatus: ValidationResult;
  validators: ValidatingFunction[];
  focus: () => void;
  userInput: () => unknown;
  setData: (data: unknown) => void;
  clearData: () => void;
  vuetifyRules: () => Array<(value: unknown) => boolean | string>;
  generateTags: () => string[];
  generateELO: () => CourseElo | undefined;
  validate: () => ValidationResult;
}

// Type guard
export function isFieldInput(component: unknown): component is FieldInputInstance {
  return (
    component !== null &&
    typeof component === 'object' &&
    'clearData' in component &&
    'validate' in component &&
    typeof (component as Record<string, unknown>).clearData === 'function' &&
    typeof (component as Record<string, unknown>).validate === 'function'
  );
}

// This combines the Vue component instance type with our interface
export type FieldInputInstance = ComponentPublicInstance & FieldInputInterface;
