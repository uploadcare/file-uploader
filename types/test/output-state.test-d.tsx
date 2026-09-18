import { expectTypeOf, test } from 'vitest';
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
declare const state: OutputCollectionState;

test('a success entry has its upload result and no errors', () => {
  if (entry.status === 'success') {
    expectTypeOf(entry.fileInfo).toEqualTypeOf<UploadcareFile>();
    expectTypeOf(entry.uuid).toEqualTypeOf<string>();
    expectTypeOf(entry.cdnUrl).toEqualTypeOf<string>();
    expectTypeOf(entry.cdnUrlModifiers).toEqualTypeOf<string>();
    expectTypeOf(entry.isSuccess).toEqualTypeOf<true>();
    expectTypeOf(entry.errors).toEqualTypeOf<[]>();
  }
});

test('a failed or removed entry may carry a partial result and file errors', () => {
  if (entry.status === 'failed') {
    expectTypeOf(entry.isFailed).toEqualTypeOf<true>();
    expectTypeOf(entry.uuid).toEqualTypeOf<string | null>();
    expectTypeOf(entry.errors).toEqualTypeOf<OutputError<OutputFileErrorType>[]>();
  }
  if (entry.status === 'removed') {
    expectTypeOf(entry.isRemoved).toEqualTypeOf<true>();
    expectTypeOf(entry.errors).toEqualTypeOf<OutputError<OutputFileErrorType>[]>();
  }
});

test('an idle or uploading entry has no result yet', () => {
  if (entry.status === 'uploading') {
    expectTypeOf(entry.isUploading).toEqualTypeOf<true>();
    expectTypeOf(entry.uuid).toEqualTypeOf<null>();
    expectTypeOf(entry.fileInfo).toEqualTypeOf<null>();
  }
  if (entry.status === 'idle') {
    expectTypeOf(entry.cdnUrl).toEqualTypeOf<null>();
    expectTypeOf(entry.isRemoved).toEqualTypeOf<false>();
  }
});

test('the boolean flags narrow the status too', () => {
  if (entry.isSuccess) {
    expectTypeOf(entry.status).toEqualTypeOf<'success'>();
  }
});

test('the generic parameter is the same narrowing spelled up front', () => {
  expectTypeOf<OutputFileEntry<'success'>['cdnUrl']>().toEqualTypeOf<string>();
  expectTypeOf<OutputCollectionState<'success', 'has-group'>['group']>().toEqualTypeOf<UploadcareGroup>();
});

test('the collection narrows its entries and errors by status', () => {
  if (state.status === 'success') {
    expectTypeOf(state.isSuccess).toEqualTypeOf<true>();
    expectTypeOf(state.allEntries).toEqualTypeOf<OutputFileEntry<'success'>[]>();
    expectTypeOf(state.errors).toEqualTypeOf<[]>();
    expectTypeOf(state.group).toEqualTypeOf<UploadcareGroup | null>();
  }
  if (state.status === 'failed') {
    expectTypeOf(state.errors).toEqualTypeOf<OutputError<OutputCollectionErrorType>[]>();
  }
  if (state.status === 'idle') {
    expectTypeOf(state.allEntries).toEqualTypeOf<OutputFileEntry<'idle' | 'success'>[]>();
  }
});

test('QUIRK(types): the collection counts do not narrow with the status', () => {
  // A `success` collection still types `failedCount` as `number`, while `isFailed` next to it is the literal `false`
  // (exported.ts OutputCollectionState). Pinned as current behaviour, not endorsed.
  if (state.status === 'success') {
    expectTypeOf(state.failedCount).toEqualTypeOf<number>();
  }
});
