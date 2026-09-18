import { expectType } from 'tsd';
import type {
  OutputCollectionErrorType,
  OutputCollectionState,
  OutputError,
  OutputFileEntry,
  OutputFileErrorType,
  UploadcareFile,
  UploadcareGroup,
} from '../../dist/index';

/** Narrowing on `status` is the documented way to read an entry or the collection; each branch must pin its fields. */

declare const entry: OutputFileEntry;

if (entry.status === 'success') {
  expectType<UploadcareFile>(entry.fileInfo);
  expectType<string>(entry.uuid);
  expectType<string>(entry.cdnUrl);
  expectType<string>(entry.cdnUrlModifiers);
  expectType<true>(entry.isSuccess);
  expectType<[]>(entry.errors);
}
if (entry.status === 'failed') {
  expectType<true>(entry.isFailed);
  expectType<string | null>(entry.uuid);
  expectType<OutputError<OutputFileErrorType>[]>(entry.errors);
}
if (entry.status === 'uploading') {
  expectType<true>(entry.isUploading);
  expectType<null>(entry.uuid);
  expectType<null>(entry.fileInfo);
}
if (entry.status === 'idle') {
  expectType<null>(entry.cdnUrl);
  expectType<false>(entry.isRemoved);
}
if (entry.status === 'removed') {
  expectType<true>(entry.isRemoved);
}
// The flags narrow too.
if (entry.isSuccess) {
  expectType<'success'>(entry.status);
}
// The generic form is the same narrowing, spelled up front.
declare const success: OutputFileEntry<'success'>;
expectType<string>(success.cdnUrl);

declare const state: OutputCollectionState;

if (state.status === 'success') {
  expectType<true>(state.isSuccess);
  expectType<OutputFileEntry<'success'>[]>(state.allEntries);
  expectType<[]>(state.errors);
  expectType<UploadcareGroup | null>(state.group);
}
if (state.status === 'failed') {
  expectType<OutputError<OutputCollectionErrorType>[]>(state.errors);
}
if (state.status === 'idle') {
  expectType<OutputFileEntry<'idle' | 'success'>[]>(state.allEntries);
}
// A collection known to carry a group has a non-null group.
declare const grouped: OutputCollectionState<'success', 'has-group'>;
expectType<UploadcareGroup>(grouped.group);

// QUIRK(types): the counts do not narrow with the status — a `success` collection still types `failedCount` as
// `number`, while `isFailed` next to it is the literal `false` (exported.ts OutputCollectionState). Pinned as current
// behaviour, not endorsed.
if (state.status === 'success') {
  expectType<number>(state.failedCount);
}
