import { describe, expect, it, vi } from 'vitest';
import { ControllerContainer } from '../di/ControllerContainer';
import { UploaderEventType } from '../EventBus';
import { EventEmitter } from '../EventEmitter';
import type { Uid } from '../Uid';
import { CollectionStateController } from './CollectionStateController';
import { UploadCollectionController } from './UploadCollectionController';
import { UploadCollectionEventsController } from './UploadCollectionEventsController';

const setup = () => {
  const container = new ControllerContainer();
  const emit = vi.fn();
  container.bind(EventEmitter, () => ({ emit }) as unknown as EventEmitter);
  const collection = container.get(UploadCollectionController);
  const collectionState = container.get(CollectionStateController);
  const events = container.get(UploadCollectionEventsController);
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
