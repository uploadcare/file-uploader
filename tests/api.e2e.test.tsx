import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import '../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

beforeEach(() => {
  const ctxName = `test-${Math.random().toString(36).slice(2)}`;
  page.render(
    <>
      <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
      <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
    </>,
  );
});

describe('API', () => {
  // M9n Task 1 — gap-fill ahead of the ctx-creation-seam move (map creation +
  // upload-state seeds move controller-side). Pins the documented idle
  // default shape `getOutputCollectionState()` returns on a fresh
  // composition, before any file is added — i.e. the seeded
  // `*commonProgress`/`*collectionErrors`/`*groupInfo`/`*uploadList` values
  // from `uploaderBlockCtx` (src/abstract/CTX.ts), read via the plain
  // getters in `buildOutputCollectionState`. Nothing in the existing suite
  // asserts this pre-upload shape — every other `getOutputCollectionState()`
  // read happens after at least one `addFile*` call.
  it('getOutputCollectionState() returns the idle default shape on a fresh composition, before any upload activity', () => {
    const uploadCtxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = uploadCtxProvider.api;

    const state = api.getOutputCollectionState();

    expect(state).toMatchObject({
      status: 'idle',
      totalCount: 0,
      successCount: 0,
      failedCount: 0,
      uploadingCount: 0,
      progress: 0,
      errors: [],
      group: null,
      isFailed: false,
      isUploading: false,
      isSuccess: false,
      allEntries: [],
      successEntries: [],
      failedEntries: [],
      uploadingEntries: [],
      idleEntries: [],
    });
  });
});
