import { Status } from '@vue-skuilder/common';
import { ValidationResult } from '../../../../base-course/Interfaces/ValidationResult';

const okResult: ValidationResult = {
  status: Status.ok,
  msg: '',
};

export function numberValidator(value: string): ValidationResult {
  const errorResult: ValidationResult = {
    status: Status.error,
    msg: 'This input must be a number',
  };

  if (isNumeric(value)) {
    return okResult;
  } else {
    return errorResult;
  }
}

export function integerValidator(value: string): ValidationResult {
  const errorResult: ValidationResult = {
    status: Status.error,
    msg: 'This input must be an integer (..., -2, -1, 0, 1, 2, ...).',
  };

  if (numberValidator(value).status === Status.error) {
    return numberValidator(value);
  }

  if (isInteger(value)) {
    return okResult;
  } else {
    return errorResult;
  }
}

function isNumeric(value: unknown): boolean {
  // pilfered from Angular and assumed to be correctish:
  // https://github.com/angular/angular/blob/4.3.x/packages/common/src/pipes/number_pipe.ts#L172

  // @ts-expect-error - see above
  return !isNaN(value - parseFloat(value));
}

function isInteger(value: string) {
  return /^[+,-]?\s?\d+$/.test(value);
}
