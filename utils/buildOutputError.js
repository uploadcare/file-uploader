/**
 * @template T
 * @param {import('../types').OutputError<T>} options
 */
const buildOutputError = ({ type, message, ...payload }) => ({
  type,
  message,
  ...payload,
});

/** @type {typeof buildOutputError<import('../types').OutputFileErrorType>} */
export const buildOutputFileError = buildOutputError;

/** @type {typeof buildOutputError<import('../types').OutputCollectionErrorType>} */
export const buildCollectionFileError = buildOutputError;
