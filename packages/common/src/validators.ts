import { Validator } from './interfaces/Validator.js';
import { Status } from './wire-format.js';

interface ValidatorIndex {
  [x: string]: Validator;
}

export const Validators: ValidatorIndex = {
  NonEmptyString: {
    instructions: '',
    test: (input: string) => {
      if (input.length !== 0) {
        return {
          status: Status.ok,
          msg: '',
        };
      } else {
        return {
          status: Status.error,
          msg: 'Input cannot be empty',
        };
      }
    },
  },
};
