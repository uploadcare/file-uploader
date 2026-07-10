import type {
  OutputCollectionStatus,
  OutputErrorCollection,
  OutputErrorFile,
  OutputFileEntry,
  UploaderPublicApi,
} from '../types';
import type { buildOutputCollectionState } from './buildOutputCollectionState';

/**
 * Public validator function/descriptor types. Previously declared in
 * `ValidationManager`; they live here now that validation runs through the
 * DOM-free `ValidationController` (and `ValidationManager` is gone).
 */
export type FuncFileValidator = (
  outputEntry: OutputFileEntry,
  api: UploaderPublicApi,
  options?: { signal?: AbortSignal },
) => undefined | OutputErrorFile | Promise<undefined | OutputErrorFile>;

export type FileValidatorDescriptor = {
  runOn: 'add' | 'upload' | 'change';
  validator: FuncFileValidator;
};

export type FileValidator = FileValidatorDescriptor | FuncFileValidator;

export type FuncCollectionValidator = (
  collection: ReturnType<typeof buildOutputCollectionState<OutputCollectionStatus>>,
  api: UploaderPublicApi,
) => undefined | OutputErrorCollection;
