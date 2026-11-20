import { describe, expect, it, vi } from 'vitest';
import { ControllerContainer } from '../di/ControllerContainer';
import { UploaderEventType } from '../EventBus';
import { EventEmitter } from '../EventEmitter';
import type { Uid } from '../Uid';
import { CollectionStateController } from './CollectionStateController';
import { ConfigController } from './ConfigController';
import { UploadCollectionController } from './UploadCollectionController';
import { UploadCollectionEventsController } from './UploadCollectionEventsController';

const setup = () => {
  const container = new ControllerContainer();
  const emit = vi.fn();
  container.bind(EventEmitter, () => ({ emit }) as unknown as EventEmitter);
  const collection = container.get(UploadCollectionController);
  const collectionState = container.get(CollectionStateController);
  const events = container.get(UploadCollectionEventsController);
  // An idle file waits for the user, so it counts as settled; in auto-upload mode it would be about to start.
  container.get(ConfigController).set('confirmUpload', true);
  const failedEmits = () => emit.mock.calls.filter(([type]) => type === UploaderEventType.COMMON_UPLOAD_FAILED);
  const fail = (uid: Uid) => collection.read(uid)!.set('errors', [{ type: 'X', message: 'm' }] as never);
  return { collection, collectionState, events, failedEmits, fail };
};

describe('UploadCollectionEventsController.emitCommonFailedIfSettled', () => {
  it('reports a failed collection with nothing in flight', () => {
    const t = setup();
    t.fail(t.collection.add({ fileName: 'a.txt' }));

    t.events.emitCommonFailedIfSettled();

    expect(t.failedEmits()).toEqual([
      [UploaderEventType.COMMON_UPLOAD_FAILED, expect.any(Function), { debounce: true }],
    ]);
  });

  it('reports a collection error with no failed file', () => {
    const t = setup();
    t.collection.add({ fileName: 'a.txt' });
    t.collectionState.set('collectionErrors', [{ type: 'TOO_FEW_FILES', message: 'm' }] as never);

    t.events.emitCommonFailedIfSettled();

    expect(t.failedEmits()).toHaveLength(1);
  });

  it('waits while another file still uploads, queues or validates', () => {
    for (const flag of [
      'isUploading',
      'isQueuedForUploading',
      'isValidationPending',
      'isQueuedForValidation',
    ] as const) {
      const t = setup();
      t.fail(t.collection.add({ fileName: 'a.txt' }));
      const other = t.collection.add({ fileName: 'b.txt' });
      t.collection.read(other)!.set(flag, true);

      t.events.emitCommonFailedIfSettled();
      expect(t.failedEmits(), flag).toHaveLength(0);

      t.collection.read(other)!.set(flag, false);
      t.events.emitCommonFailedIfSettled();
      expect(t.failedEmits(), flag).toHaveLength(1);
    }
  });

  it('reports a settled failure once, however often it is checked', () => {
    const t = setup();
    t.fail(t.collection.add({ fileName: 'a.txt' }));

    t.events.emitCommonFailedIfSettled();
    t.events.emitCommonFailedIfSettled();

    expect(t.failedEmits()).toHaveLength(1);
  });

  it('reports again once a new upload in the same collection settles failed', () => {
    const t = setup();
    t.fail(t.collection.add({ fileName: 'a.txt' }));
    t.events.emitCommonFailedIfSettled();

    const next = t.collection.add({ fileName: 'b.txt' });
    t.collection.read(next)!.set('isUploading', true);
    t.events.emitCommonFailedIfSettled();
    t.collection.read(next)!.set('isUploading', false);
    t.fail(next);
    t.events.emitCommonFailedIfSettled();

    expect(t.failedEmits()).toHaveLength(2);
  });

  it('does not report a collection without failures', () => {
    const t = setup();
    t.collection.add({ fileName: 'a.txt' });

    t.events.emitCommonFailedIfSettled();

    expect(t.failedEmits()).toHaveLength(0);
  });
});

describe('UploadCollectionEventsController.emitCommonFailedIfSettled, once per failure', () => {
  const setupWithConfig = () => {
    const container = new ControllerContainer();
    const emit = vi.fn();
    container.bind(EventEmitter, () => ({ emit }) as unknown as EventEmitter);
    const collection = container.get(UploadCollectionController);
    return {
      config: container.get(ConfigController),
      collection,
      collectionState: container.get(CollectionStateController),
      events: container.get(UploadCollectionEventsController),
      failedEmits: () => emit.mock.calls.filter(([type]) => type === UploaderEventType.COMMON_UPLOAD_FAILED),
      fail: (uid: Uid) => collection.read(uid)!.set('errors', [{ type: 'X', message: 'm' }] as never),
    };
  };

  it('does not report again when an uploaded file is validated again', () => {
    const t = setupWithConfig();
    t.fail(t.collection.add({ fileName: 'a.txt' }));
    const uploaded = t.collection.add({ fileName: 'b.png', fileInfo: { uuid: 'u1' } as never });
    t.events.emitCommonFailedIfSettled();

    for (const flag of ['isQueuedForValidation', 'isValidationPending'] as const) {
      t.collection.read(uploaded)!.set(flag, true);
      t.events.emitCommonFailedIfSettled();
      t.collection.read(uploaded)!.set(flag, false);
      t.events.emitCommonFailedIfSettled();
    }

    expect(t.failedEmits()).toHaveLength(1);
  });

  it('does not report again when a rejected file is validated again with the same verdict', () => {
    const t = setupWithConfig();
    const rejected = t.collection.add({ fileName: 'a.txt' });
    t.fail(rejected);
    t.events.emitCommonFailedIfSettled();

    t.collection.read(rejected)!.set('isValidationPending', true);
    t.events.emitCommonFailedIfSettled();
    t.collection.read(rejected)!.set('isValidationPending', false);
    t.fail(rejected);
    t.events.emitCommonFailedIfSettled();

    expect(t.failedEmits()).toHaveLength(1);
  });

  it('does not report again when the files over the limit are validated again', () => {
    const t = setupWithConfig();
    t.config.set('multiple', false);
    const files = [t.collection.add({ fileName: 'a.png' }), t.collection.add({ fileName: 'b.png' })];
    t.collectionState.set('collectionErrors', [{ type: 'TOO_MANY_FILES', message: 'm' }] as never);
    t.events.emitCommonFailedIfSettled();

    for (const uid of files) t.collection.read(uid)!.set('isValidationPending', true);
    t.events.emitCommonFailedIfSettled();
    for (const uid of files) t.collection.read(uid)!.set('isValidationPending', false);
    t.events.emitCommonFailedIfSettled();

    expect(t.failedEmits()).toHaveLength(1);
  });

  it('waits for a validated file that is about to upload on its own', () => {
    const t = setupWithConfig();
    t.fail(t.collection.add({ fileName: 'a.txt' }));
    const ready = t.collection.add({ fileName: 'b.png' });

    t.events.emitCommonFailedIfSettled();
    expect(t.failedEmits()).toHaveLength(0);

    t.collection.read(ready)!.set('isUploading', true);
    t.events.emitCommonFailedIfSettled();
    t.collection.read(ready)!.setMany({ isUploading: false, fileInfo: { uuid: 'u1' } as never });
    t.events.emitCommonFailedIfSettled();
    expect(t.failedEmits()).toHaveLength(1);
  });

  it('waits for a file whose upload failed until its error is validated', () => {
    const t = setupWithConfig();
    t.config.set('confirmUpload', true);
    t.fail(t.collection.add({ fileName: 'a.txt' }));
    const failed = t.collection.add({ fileName: 'b.png', uploadError: new Error('rejected') as never });

    t.events.emitCommonFailedIfSettled();
    expect(t.failedEmits()).toHaveLength(0);

    t.fail(failed);
    t.events.emitCommonFailedIfSettled();
    expect(t.failedEmits()).toHaveLength(1);
  });

  it('does not wait for a file that waits for the user to start the upload', () => {
    const t = setupWithConfig();
    t.config.set('confirmUpload', true);
    t.fail(t.collection.add({ fileName: 'a.txt' }));
    t.collection.add({ fileName: 'b.png' });

    t.events.emitCommonFailedIfSettled();

    expect(t.failedEmits()).toHaveLength(1);
  });

  it('reports a file rejected after the last report', () => {
    const t = setupWithConfig();
    t.config.set('confirmUpload', true);
    t.fail(t.collection.add({ fileName: 'a.txt' }));
    t.events.emitCommonFailedIfSettled();

    t.fail(t.collection.add({ fileName: 'b.txt' }));
    t.events.emitCommonFailedIfSettled();

    expect(t.failedEmits()).toHaveLength(2);
  });

  it('reports a file that fails again after it was uploaded again', () => {
    const t = setupWithConfig();
    t.fail(t.collection.add({ fileName: 'a.txt' }));
    const retried = t.collection.add({ fileName: 'b.txt' });
    t.fail(retried);
    t.events.emitCommonFailedIfSettled();

    t.collection.read(retried)!.setMany({ isUploading: true, errors: [] });
    t.events.emitCommonFailedIfSettled();
    t.collection.read(retried)!.set('isUploading', false);
    t.fail(retried);
    t.events.emitCommonFailedIfSettled();

    expect(t.failedEmits()).toHaveLength(2);
  });

  it('does not report again when a failed file is removed and another stays failed', () => {
    const t = setupWithConfig();
    const removed = t.collection.add({ fileName: 'a.txt' });
    t.fail(removed);
    t.fail(t.collection.add({ fileName: 'b.txt' }));
    t.events.emitCommonFailedIfSettled();

    t.collection.remove(removed);
    t.events.emitCommonFailedIfSettled();

    expect(t.failedEmits()).toHaveLength(1);
  });

  it('reports a collection error again once the files change, after it was reported for the empty list', () => {
    const t = setupWithConfig();
    t.config.set('multiple', true);
    t.config.set('multipleMin', 2);
    t.config.set('confirmUpload', true);
    t.collectionState.set('collectionErrors', [{ type: 'TOO_FEW_FILES', message: 'm' }] as never);
    t.events.emitCommonFailedIfSettled();

    const added = t.collection.read(t.collection.add({ fileName: 'a.png' }))!;
    t.events.resetGroupIfMembershipChanged(new Set([added]), new Set());
    t.events.emitCommonFailedIfSettled();

    expect(t.failedEmits()).toHaveLength(2);
  });

  it('reports a standing collection error again once a new upload batch settles', () => {
    const t = setupWithConfig();
    t.config.set('multiple', true);
    t.config.set('multipleMin', 2);
    t.config.set('confirmUpload', true);
    const file = t.collection.add({ fileName: 'a.png' });
    t.collectionState.set('collectionErrors', [{ type: 'TOO_FEW_FILES', message: 'm' }] as never);
    t.events.emitCommonFailedIfSettled();

    t.events.startBatch();
    t.collection.read(file)!.set('isUploading', true);
    t.events.emitCommonFailedIfSettled();
    t.collection.read(file)!.setMany({ isUploading: false, fileInfo: { uuid: 'u1' } as never });
    t.events.emitCommonFailedIfSettled();
    t.events.emitCommonFailedIfSettled();

    expect(t.failedEmits()).toHaveLength(2);
  });

  it('keeps a reported file failure reported across a new upload batch', () => {
    const t = setupWithConfig();
    t.config.set('multiple', true);
    t.config.set('confirmUpload', true);
    t.fail(t.collection.add({ fileName: 'a.txt' }));
    const file = t.collection.add({ fileName: 'b.png' });
    t.events.emitCommonFailedIfSettled();

    t.events.startBatch();
    t.collection.read(file)!.set('isUploading', true);
    t.events.emitCommonFailedIfSettled();
    t.collection.read(file)!.setMany({ isUploading: false, fileInfo: { uuid: 'u1' } as never });
    t.events.emitCommonFailedIfSettled();

    expect(t.failedEmits()).toHaveLength(1);
  });
});
