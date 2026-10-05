import type { FuncCollectionValidator } from '../../../abstract/managers/ValidationManager';

/**
 * Reports a group creation that failed.
 *
 * Every file uploaded, so nothing else in the collection is wrong; without
 * this the failure had nowhere to go, and with `groupOutput` on it is the
 * difference between an output with a group and one silently without.
 */
export const validateGroupError: FuncCollectionValidator = (_collection, api) => {
  const error = api._groupError;
  if (!error) {
    return undefined;
  }

  return {
    type: 'GROUP_ERROR',
    message: error.message,
    payload: { error },
  };
};
