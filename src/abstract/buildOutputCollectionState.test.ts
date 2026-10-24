import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildOutputCollectionState } from './buildOutputCollectionState';
import { CollectionStateController } from './controllers/CollectionStateController';
import { UploadCollectionController } from './controllers/UploadCollectionController';
import { ControllerContainer } from './di/ControllerContainer';
import { __resetLoggerForTests } from './logger';
import { UploaderPublicApi } from './UploaderPublicApi';

// Cover-first parity net for `buildOutputCollectionState` (no dedicated test
// existed) ahead of a single-pass perf refactor. Pins the derived counts /
// status / entry partitions / flags so the refactor is provably behavior-
// preserving on the documented `getOutputCollectionState` surface.
describe('buildOutputCollectionState', () => {
  let container: ControllerContainer;
  let collection: UploadCollectionController;
  let collectionState: CollectionStateController;

  beforeEach(() => {
    container = new ControllerContainer();
    collection = container.get(UploadCollectionController);
    collectionState = container.get(CollectionStateController);
    // getOutputData resolves through the public API; force it into existence.
    container.get(UploaderPublicApi);
  });
  afterEach(() => {
    container.dispose();
    vi.restoreAllMocks();
    vi.useRealTimers();
    __resetLoggerForTests();
  });

  // status derivation (getOutputItem): removed → failed(errors) → success(fileInfo)
  // → uploading(isUploading) → idle.
  const addIdle = () => collection.add({});
  const addUploading = () => collection.add({ isUploading: true });
  const addSuccess = () => collection.add({ fileInfo: { uuid: 'srv' } as never });
  const addFailed = () => collection.add({ errors: [{ type: 'X', message: 'e' } as never] });

  it('counts and partitions entries by derived status', () => {
    const idle = addIdle();
    const uploading = addUploading();
    const success = addSuccess();
    const failed = addFailed();

    const state = buildOutputCollectionState(container);

    expect(state.totalCount).toBe(4);
    expect(state.successCount).toBe(1);
    expect(state.uploadingCount).toBe(1);
    expect(state.failedCount).toBe(1);
    expect(state.allEntries).toHaveLength(4);
    expect(state.successEntries.map((e) => e.internalId)).toEqual([success]);
    expect(state.uploadingEntries.map((e) => e.internalId)).toEqual([uploading]);
    expect(state.failedEntries.map((e) => e.internalId)).toEqual([failed]);
    expect(state.idleEntries.map((e) => e.internalId)).toEqual([idle]);
  });

  it('status is failed when any entry has errors, uploading > success > idle otherwise', () => {
    // failed dominates.
    addSuccess();
    addUploading();
    const withFailed = addFailed();
    expect(buildOutputCollectionState(container).status).toBe('failed');
    collection.remove(withFailed);

    // uploading dominates success/idle.
    expect(buildOutputCollectionState(container).status).toBe('uploading');
  });

  it('idle when empty; isSuccess only when all entries succeeded and no collection errors', () => {
    expect(buildOutputCollectionState(container).status).toBe('idle');
    expect(buildOutputCollectionState(container).isSuccess).toBe(false); // empty → not success

    addSuccess();
    addSuccess();
    const all = buildOutputCollectionState(container);
    expect(all.isSuccess).toBe(true);
    expect(all.status).toBe('success');
  });

  it('isFailed via a collection-level error even with no failed entries', () => {
    addSuccess();
    collectionState.set('collectionErrors', [{ type: 'TOO_MANY_FILES', message: 'too many' } as never]);

    const state = buildOutputCollectionState(container);
    expect(state.errors).toHaveLength(1);
    expect(state.isFailed).toBe(true);
    expect(state.status).toBe('failed');
    expect(state.isSuccess).toBe(false); // collection error blocks success
  });

  it('surfaces progress and group straight from CollectionStateController', () => {
    collectionState.set('commonProgress', 42);
    collectionState.set('groupInfo', { uuid: 'group~1' } as never);

    const state = buildOutputCollectionState(container);
    expect(state.progress).toBe(42);
    expect(state.group).toEqual({ uuid: 'group~1' });
  });

  it('spreads into a plain object carrying every documented field', () => {
    addSuccess();
    const plain = { ...buildOutputCollectionState(container) };

    expect(Object.keys(plain).sort()).toEqual(
      [
        'allEntries',
        'errors',
        'failedCount',
        'failedEntries',
        'group',
        'idleEntries',
        'isFailed',
        'isSuccess',
        'isUploading',
        'progress',
        'status',
        'successCount',
        'successEntries',
        'totalCount',
        'uploadingCount',
        'uploadingEntries',
      ].sort(),
    );
    expect(Object.getOwnPropertyDescriptor(plain, 'allEntries')?.get).toBeUndefined();
    expect(plain.successCount).toBe(1);
  });

  it('computes nothing until a field is read', () => {
    addSuccess();
    const getOutputItem = vi.spyOn(container.get(UploaderPublicApi), 'getOutputItem');

    const state = buildOutputCollectionState(container);
    expect(getOutputItem).not.toHaveBeenCalled();

    void state.allEntries;
    expect(getOutputItem).toHaveBeenCalledTimes(1);
  });

  it('returns the same entries on every read', () => {
    addSuccess();
    const state = buildOutputCollectionState(container);

    expect(state.allEntries).toBe(state.allEntries);
    expect(state.successEntries[0]).toBe(state.allEntries[0]);
  });

  it('warns once about a read made after the task that built it', () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const state = buildOutputCollectionState(container);
    void state.totalCount;
    expect(warn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(0);
    void state.totalCount;
    void state.progress;
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[1])).toContain('asynchronously');
  });
});
