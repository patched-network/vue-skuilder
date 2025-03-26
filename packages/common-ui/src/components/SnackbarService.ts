// common-ui/src/components/SnackbarService.ts
import { Status } from '@vue-skuilder/common';

export interface SnackbarOptions {
  text: string;
  status: Status;
  timeout?: number;
}

// Module for managing the snackbar service
const SnackbarServiceModule = (() => {
  // Private variable to hold the instance
  let _instance: { addSnack: (snack: SnackbarOptions) => void } | null = null;

  return {
    // Register the instance
    setInstance(instance: { addSnack: (snack: SnackbarOptions) => void }): void {
      _instance = instance;
    },

    // Get the current instance
    getInstance(): { addSnack: (snack: SnackbarOptions) => void } | null {
      return _instance;
    },

    // Alert user function
    alertUser(msg: SnackbarOptions): void {
      // Try getting the instance
      const snackBarService = _instance;
      if (snackBarService) {
        snackBarService.addSnack(msg);
        return;
      }
      console.error('SnackbarService not found');
    },
  };
})();

export const { setInstance, getInstance, alertUser } = SnackbarServiceModule;
