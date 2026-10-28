import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetTaskClockForTests, buildOutputCollectionState } from './buildOutputCollectionState';
import { CollectionStateController } from './controllers/CollectionStateController';
import { UploadCollectionController } from './controllers/UploadCollectionController';
import { ControllerContainer } from './di/ControllerContainer';
import { __resetLoggerForTests } from './logger';

// Cover-first parity net for `buildOutputCollectionState` (no dedicated test
// existed) ahead of a single-pass perf refactor. Pins the derived counts /
// status / entry partitions / flags so the refactor is provably behavior-
// preserving on the documented `getOutputCollectionState` surface.
describe('buildOutputCollectionState', () => {
  let container: ControllerContainer;
  let collection: UploadCollectionController;
  let collectionState: CollectionStateController;

  beforeEach(() => {
    __resetTaskClockForTests();
    container = new ControllerContainer();
    collection = container.get(UploadCollectionController);
    collectionState = container.get(CollectionStateController);
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

  it('reports progress, errors, group and totalCount as they were when it was built', () => {
    collectionState.set('commonProgress', 10);
    addSuccess();
    const state = buildOutputCollectionState(container);

    collectionState.set('commonProgress', 50);
    collectionState.set('collectionErrors', [{ type: 'TOO_MANY_FILES', message: 'too many' } as never]);
    collectionState.set('groupInfo', { uuid: 'group~1' } as never);
    addUploading();

    expect({
      progress: state.progress,
      errors: state.errors,
      group: state.group,
      totalCount: state.totalCount,
    }).toEqual({ progress: 10, errors: [], group: null, totalCount: 1 });
  });

  it('reports every entry-derived field from the moment the first of them is read', () => {
    addSuccess();
    const state = buildOutputCollectionState(container);
    expect(state.successCount).toBe(1);

    addUploading();

    expect({
      entries: state.allEntries.length,
      uploadingEntries: state.uploadingEntries.length,
      isUploading: state.isUploading,
      isSuccess: state.isSuccess,
      status: state.status,
    }).toEqual({ entries: 1, uploadingEntries: 0, isUploading: false, isSuccess: true, status: 'success' });
  });

  it('builds no output entries for a read of the build-time fields', () => {
    addSuccess();
    const read = vi.spyOn(collection, 'read');
    const state = buildOutputCollectionState(container);

    void [state.progress, state.errors, state.group, state.totalCount];
    expect(read).not.toHaveBeenCalled();
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

  it('spreads into a copy that structuredClone accepts, as v1 states did', () => {
    addSuccess();
    const state = buildOutputCollectionState(container);

    expect(structuredClone({ ...state }).successCount).toBe(1);
    expect(structuredClone(state.snapshot()).successCount).toBe(1);
  });

  it('computes nothing until a field is read', () => {
    addSuccess();
    const read = vi.spyOn(collection, 'read');

    const state = buildOutputCollectionState(container);
    expect(read).not.toHaveBeenCalled();

    void state.allEntries;
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('names the late read, not the container, when its entries are read after the uploader is destroyed', () => {
    addSuccess();
    const state = buildOutputCollectionState(container);
    container.dispose();

    expect(state.totalCount).toBe(1);
    expect(() => state.allEntries).toThrow(
      /OutputCollectionState's file entries were read after its uploader was destroyed.*state\.snapshot\(\)/,
    );
  });

  it('returns the same entries on every read', () => {
    addSuccess();
    const state = buildOutputCollectionState(container);

    expect(state.allEntries).toBe(state.allEntries);
    expect(state.successEntries[0]).toBe(state.allEntries[0]);
  });

  describe('snapshot()', () => {
    it('returns a plain copy of every field, equal to a spread', () => {
      addSuccess();
      addUploading();
      const state = buildOutputCollectionState(container);

      const copy = state.snapshot();
      expect(Object.getOwnPropertyDescriptor(copy, 'status')?.get).toBeUndefined();
      expect(copy).toEqual({ ...state });
      expect(copy.status).toBe('uploading');
    });

    it('keeps the values it read once the collection moves on', () => {
      addSuccess();
      const copy = buildOutputCollectionState(container).snapshot();
      addUploading();

      expect([copy.totalCount, copy.allEntries.length, copy.status]).toEqual([1, 1, 'success']);
    });

    it('on a snapshot, copies that copy without a warning', () => {
      vi.useFakeTimers();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      addSuccess();
      const copy = buildOutputCollectionState(container).snapshot();
      vi.advanceTimersByTime(0);
      addUploading();

      expect(copy.snapshot()).toEqual(copy);
      expect(copy.snapshot().snapshot().totalCount).toBe(1);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('late-read warning', () => {
    const warnings = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

    it('warns once when the file entries are first read in a later task', () => {
      vi.useFakeTimers();
      const warn = warnings();
      addSuccess();
      const first = buildOutputCollectionState(container);
      const second = buildOutputCollectionState(container);
      vi.advanceTimersByTime(0);

      void first.status;
      void second.allEntries;
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[1])).toContain('after the task that created it');
    });

    it('does not warn about a late read of a build-time field', () => {
      vi.useFakeTimers();
      const warn = warnings();
      const state = buildOutputCollectionState(container);
      vi.advanceTimersByTime(0);

      void [state.progress, state.errors, state.group, state.totalCount];
      expect(warn).not.toHaveBeenCalled();
    });

    it('does not warn about a late read of entries taken in the task that built it', () => {
      vi.useFakeTimers();
      const warn = warnings();
      addSuccess();
      const state = buildOutputCollectionState(container);
      void state.status;
      vi.advanceTimersByTime(0);

      void [state.allEntries, state.successEntries, state.snapshot()];
      expect(warn).not.toHaveBeenCalled();
    });

    it('does not warn about a state built in a later task and read in it', () => {
      vi.useFakeTimers();
      const warn = warnings();
      addSuccess();
      void buildOutputCollectionState(container);
      vi.advanceTimersByTime(0);

      void buildOutputCollectionState(container).status;
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('mixed-read warning', () => {
    const warnings = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

    it('warns, naming the field, when a read combines a changed build-time field with the entries', () => {
      const warn = warnings();
      addSuccess();
      const state = buildOutputCollectionState(container);
      void state.progress;

      collectionState.set('commonProgress', 50);
      void state.status;

      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[1])).toContain('`progress`');
    });

    it('warns when the changed field is read after the entries', () => {
      const warn = warnings();
      addSuccess();
      const state = buildOutputCollectionState(container);
      addUploading();

      void state.allEntries;
      expect(warn).not.toHaveBeenCalled();
      void state.totalCount;
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[1])).toContain('`totalCount`');
    });

    it('does not warn when a field that changed is never read', () => {
      const warn = warnings();
      addSuccess();
      const state = buildOutputCollectionState(container);
      collectionState.set('commonProgress', 50);

      void [state.status, state.errors, state.group, state.totalCount, state.allEntries];
      expect(warn).not.toHaveBeenCalled();
    });

    it('treats a fresh errors array with the same errors as unchanged', () => {
      const warn = warnings();
      const error = { type: 'TOO_MANY_FILES', message: 'too many' } as never;
      collectionState.set('collectionErrors', [error]);
      const state = buildOutputCollectionState(container);
      void state.errors;

      collectionState.set('collectionErrors', [{ ...(error as object) } as never]);
      void state.status;
      expect(warn).not.toHaveBeenCalled();
    });

    it('prints a given warning once per page', () => {
      const warn = warnings();
      for (let i = 0; i < 3; i++) {
        const state = buildOutputCollectionState(container);
        void state.progress;
        collectionState.set('commonProgress', i + 1);
        void state.status;
      }
      expect(warn).toHaveBeenCalledTimes(1);
    });
  });
});
