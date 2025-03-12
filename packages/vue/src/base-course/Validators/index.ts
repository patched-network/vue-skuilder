import { Validator, Status } from '@vue-skuilder/common';

export const NonEmptyString: Validator = {
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
};
