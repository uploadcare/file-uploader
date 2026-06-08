import type {
  OutputCollectionState,
  OutputCollectionStatus,
  OutputErrorCollection,
  OutputErrorFile,
  OutputFileEntry,
} from '../types/exported';
import type { UploaderApi } from './UploaderApi';

/**
 * Validator type definitions. Used by `config.fileValidators` /
 * `config.collectionValidators` and re-exported from the package
 * root so consumers can type their custom validators.
 *
 * The runtime engine is `ValidationController` (`abstract/controllers/
 * ValidationController.ts`) — these are pure type exports.
 */
export type FuncFileValidator = (
  outputEntry: OutputFileEntry,
  api: UploaderApi,
  options?: { signal?: AbortSignal },
) => undefined | OutputErrorFile | Promise<undefined | OutputErrorFile>;

export type FileValidatorDescriptor = {
  runOn: 'add' | 'upload' | 'change';
  validator: FuncFileValidator;
};

export type FileValidator = FileValidatorDescriptor | FuncFileValidator;

export type FuncCollectionValidator = (
  collection: OutputCollectionState<OutputCollectionStatus>,
  api: UploaderApi,
) => undefined | OutputErrorCollection;
