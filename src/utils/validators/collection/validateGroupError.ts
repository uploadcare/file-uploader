import type { OutputErrorCollection } from '../../../types/index';

/**
 * Reports a group creation that failed.
 *
 * Every file uploaded, so nothing else in the collection is wrong; without
 * this the failure had nowhere to go, and with `groupOutput` on it is the
 * difference between an output with a group and one silently without.
 */
export const validateGroupError = (error: Error | null): OutputErrorCollection | undefined => {
  if (!error) {
    return undefined;
  }

  return {
    type: 'GROUP_ERROR',
    message: error.message,
    payload: { error },
  };
};
