import '../jsx';
import React, { useRef } from 'react';
import { expectTypeOf, test } from 'vitest';
import {
  type ActivityType,
  type EventMap,
  type ModalId,
  type OutputCollectionErrorType,
  type OutputCollectionStatus,
  type OutputError,
  type OutputFileEntry,
  type OutputFileErrorType,
  type SourceTypes,
  UploadCtxProvider,
  type UploadcareFile,
  type UploadcareGroup,
} from '../../dist/index';

const instance = new UploadCtxProvider();
const api = instance.getAPI();
const onChange = (e: EventMap['change']) => e;

test('the provider exposes the collection and the api', () => {
  expectTypeOf(instance.uploadCollection.size).toEqualTypeOf<number>();
  api.addFileFromUrl('https://example.com/image.png');
});

test("'change' listeners receive the typed CustomEvent", () => {
  instance.addEventListener('change', (e) => {
    expectTypeOf(e).toEqualTypeOf<EventMap['change']>();
  });
  instance.addEventListener('change', onChange);
});

test("'change' event payload narrows the collection by status", () => {
  instance.addEventListener('change', (e) => {
    const state = e.detail;

    expectTypeOf(state.failedEntries).toEqualTypeOf<OutputFileEntry<'failed'>[]>();
    expectTypeOf(state.uploadingEntries).toEqualTypeOf<OutputFileEntry<'uploading'>[]>();
    expectTypeOf(state.successEntries).toEqualTypeOf<OutputFileEntry<'success'>[]>();
    expectTypeOf(state.idleEntries).toEqualTypeOf<OutputFileEntry<'idle'>[]>();
    // group is optional here
    expectTypeOf(state.group).toEqualTypeOf<UploadcareGroup | null>();

    if (state.status === 'success' || state.isSuccess) {
      expectTypeOf(state.status).toEqualTypeOf<'success'>();
      expectTypeOf(state.isSuccess).toEqualTypeOf<true>();
      expectTypeOf(state.isFailed).toEqualTypeOf<false>();
      expectTypeOf(state.isUploading).toEqualTypeOf<false>();
      expectTypeOf(state.errors).toEqualTypeOf<[]>();
      expectTypeOf(state.allEntries[0].status).toEqualTypeOf<'success'>();
    } else if (state.status === 'failed' || state.isFailed) {
      expectTypeOf(state.status).toEqualTypeOf<'failed'>();
      expectTypeOf(state.isSuccess).toEqualTypeOf<false>();
      expectTypeOf(state.isFailed).toEqualTypeOf<true>();
      expectTypeOf(state.isUploading).toEqualTypeOf<false>();
      expectTypeOf(state.errors).toEqualTypeOf<OutputError<OutputCollectionErrorType>[]>();
    } else if (state.status === 'uploading' || state.isUploading) {
      expectTypeOf(state.status).toEqualTypeOf<'uploading'>();
      expectTypeOf(state.isSuccess).toEqualTypeOf<false>();
      expectTypeOf(state.isFailed).toEqualTypeOf<false>();
      expectTypeOf(state.isUploading).toEqualTypeOf<true>();
      expectTypeOf(state.errors).toEqualTypeOf<[]>();
    } else {
      expectTypeOf(state.status).toEqualTypeOf<'idle'>();
      expectTypeOf(state.isSuccess).toEqualTypeOf<false>();
      expectTypeOf(state.isFailed).toEqualTypeOf<false>();
      expectTypeOf(state.isUploading).toEqualTypeOf<false>();
      expectTypeOf(state.errors).toEqualTypeOf<[]>();
      expectTypeOf(state.allEntries[0].status).toEqualTypeOf<'success' | 'idle'>();
    }
  });
});

test("'group-created' event payload", () => {
  instance.addEventListener('group-created', (e) => {
    const state = e.detail;

    // group is required here
    expectTypeOf(state.group).toEqualTypeOf<UploadcareGroup>();
  });
});

test("'done-click' event payload", () => {
  instance.addEventListener('done-click', (e) => {
    const state = e.detail;

    expectTypeOf(state.status).toEqualTypeOf<OutputCollectionStatus>();
    expectTypeOf(state.group).toEqualTypeOf<UploadcareGroup | null>();
  });
});

test("'file-added' event payload", () => {
  instance.addEventListener('file-added', (e) => {
    const state = e.detail;

    expectTypeOf(state.internalId).toEqualTypeOf<string>();
    expectTypeOf(state.isImage).toEqualTypeOf<boolean>();
    expectTypeOf(state.size).toEqualTypeOf<number>();
    expectTypeOf(state.name).toEqualTypeOf<string>();
    expectTypeOf(state.status).toEqualTypeOf<'idle'>();
    expectTypeOf(state.isSuccess).toEqualTypeOf<false>();
    expectTypeOf(state.isFailed).toEqualTypeOf<false>();
    expectTypeOf(state.isUploading).toEqualTypeOf<false>();
    expectTypeOf(state.isRemoved).toEqualTypeOf<false>();
    expectTypeOf(state.errors).toEqualTypeOf<[]>();
    expectTypeOf(state.cdnUrl).toEqualTypeOf<null>();
    expectTypeOf(state.cdnUrlModifiers).toEqualTypeOf<null>();
    expectTypeOf(state.uuid).toEqualTypeOf<null>();
    expectTypeOf(state.fileInfo).toEqualTypeOf<null>();
    expectTypeOf(state.source).toEqualTypeOf<SourceTypes | null>();
  });
});

test("'file-removed' event payload", () => {
  instance.addEventListener('file-removed', (e) => {
    const state = e.detail;

    expectTypeOf(state.internalId).toEqualTypeOf<string>();
    expectTypeOf(state.status).toEqualTypeOf<'removed'>();
    expectTypeOf(state.isSuccess).toEqualTypeOf<false>();
    expectTypeOf(state.isFailed).toEqualTypeOf<false>();
    expectTypeOf(state.isUploading).toEqualTypeOf<false>();
    expectTypeOf(state.isRemoved).toEqualTypeOf<true>();
    expectTypeOf(state.errors).toEqualTypeOf<OutputError<OutputFileErrorType>[]>();
    expectTypeOf(state.cdnUrl).toEqualTypeOf<string | null>();
    expectTypeOf(state.cdnUrlModifiers).toEqualTypeOf<string | null>();
    expectTypeOf(state.uuid).toEqualTypeOf<string | null>();
    expectTypeOf(state.fileInfo).toEqualTypeOf<UploadcareFile | null>();
  });
});

test("'file-upload-failed' event payload", () => {
  instance.addEventListener('file-upload-failed', (e) => {
    const state = e.detail;

    expectTypeOf(state.internalId).toEqualTypeOf<string>();
    expectTypeOf(state.status).toEqualTypeOf<'failed'>();
    expectTypeOf(state.isSuccess).toEqualTypeOf<false>();
    expectTypeOf(state.isFailed).toEqualTypeOf<true>();
    expectTypeOf(state.isUploading).toEqualTypeOf<false>();
    expectTypeOf(state.isRemoved).toEqualTypeOf<false>();
    expectTypeOf(state.errors).toEqualTypeOf<OutputError<OutputFileErrorType>[]>();
    expectTypeOf(state.cdnUrl).toEqualTypeOf<string | null>();
    expectTypeOf(state.cdnUrlModifiers).toEqualTypeOf<string | null>();
    expectTypeOf(state.uuid).toEqualTypeOf<string | null>();
    expectTypeOf(state.fileInfo).toEqualTypeOf<UploadcareFile | null>();
  });
});

test("'file-upload-start' event payload", () => {
  instance.addEventListener('file-upload-start', (e) => {
    const state = e.detail;

    expectTypeOf(state.internalId).toEqualTypeOf<string>();
    expectTypeOf(state.status).toEqualTypeOf<'uploading'>();
    expectTypeOf(state.isSuccess).toEqualTypeOf<false>();
    expectTypeOf(state.isFailed).toEqualTypeOf<false>();
    expectTypeOf(state.isUploading).toEqualTypeOf<true>();
    expectTypeOf(state.isRemoved).toEqualTypeOf<false>();
    expectTypeOf(state.errors).toEqualTypeOf<[]>();
    expectTypeOf(state.cdnUrl).toEqualTypeOf<null>();
    expectTypeOf(state.cdnUrlModifiers).toEqualTypeOf<null>();
    expectTypeOf(state.uuid).toEqualTypeOf<null>();
    expectTypeOf(state.fileInfo).toEqualTypeOf<null>();
  });
});

test("'file-upload-progress' event payload", () => {
  instance.addEventListener('file-upload-progress', (e) => {
    const state = e.detail;
    expectTypeOf(state.status).toEqualTypeOf<'uploading'>();
  });
});

test("'file-upload-success' event payload", () => {
  instance.addEventListener('file-upload-success', (e) => {
    const state = e.detail;

    expectTypeOf(state.internalId).toEqualTypeOf<string>();
    expectTypeOf(state.status).toEqualTypeOf<'success'>();
    expectTypeOf(state.isSuccess).toEqualTypeOf<true>();
    expectTypeOf(state.isFailed).toEqualTypeOf<false>();
    expectTypeOf(state.isUploading).toEqualTypeOf<false>();
    expectTypeOf(state.isRemoved).toEqualTypeOf<false>();
    expectTypeOf(state.errors).toEqualTypeOf<[]>();
    expectTypeOf(state.cdnUrl).toEqualTypeOf<string>();
    expectTypeOf(state.cdnUrlModifiers).toEqualTypeOf<string>();
    expectTypeOf(state.uuid).toEqualTypeOf<string>();
    expectTypeOf(state.fileInfo).toEqualTypeOf<UploadcareFile>();
  });
});

test("'file-url-changed' event payload", () => {
  instance.addEventListener('file-url-changed', (e) => {
    const state = e.detail;
    expectTypeOf(state.status).toEqualTypeOf<'success'>();
  });
});

test("'common-upload-start' event payload", () => {
  instance.addEventListener('common-upload-start', (e) => {
    const state = e.detail;
    expectTypeOf(state.status).toEqualTypeOf<'uploading'>();
  });
});

test("'common-upload-failed' event payload", () => {
  instance.addEventListener('common-upload-failed', (e) => {
    const state = e.detail;
    expectTypeOf(state.status).toEqualTypeOf<'failed'>();
  });
});

test("'common-upload-progress' event payload", () => {
  instance.addEventListener('common-upload-progress', (e) => {
    const state = e.detail;
    expectTypeOf(state.status).toEqualTypeOf<'uploading'>();
  });
});

test("'common-upload-success' event payload", () => {
  instance.addEventListener('common-upload-success', (e) => {
    const state = e.detail;
    expectTypeOf(state.status).toEqualTypeOf<'success'>();
  });
});

test("'modal-close' event payload", () => {
  instance.addEventListener('modal-close', (e) => {
    const payload = e.detail;
    expectTypeOf(payload).toEqualTypeOf<{
      modalId: ModalId;
      hasActiveModals: boolean;
    }>();
  });
});

test("'modal-open' event payload", () => {
  instance.addEventListener('modal-open', (e) => {
    const payload = e.detail;
    expectTypeOf(payload).toEqualTypeOf<{
      modalId: ModalId;
    }>();
  });
});

test("'activity-change' event payload", () => {
  instance.addEventListener('activity-change', (e) => {
    const payload = e.detail;
    expectTypeOf(payload.activity).toEqualTypeOf<ActivityType>();
  });
});

test('<uc-upload-ctx-provider> ref is typed as UploadCtxProvider', () => {
  () => {
    const ref = useRef<UploadCtxProvider>(null);
    return <uc-upload-ctx-provider ctx-name="ctx" ref={ref}></uc-upload-ctx-provider>;
  };
});
