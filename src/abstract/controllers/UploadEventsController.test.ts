import type { FileFromOptions, UploadcareGroup } from '@uploadcare/upload-client';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { EventEmitter } from '../../blocks/UploadCtxProvider/EventEmitter';
import type { Uid } from '../../lit/Uid';
import type { OutputCollectionState } from '../../types';
import { ControllerContainer } from '../di/ControllerContainer';
import { UploaderEventType } from '../EventBus';
import { PluginController } from '../managers/plugin';
import type { TypedData } from '../TypedData';
import { UploaderPublicApi } from '../UploaderPublicApi';
import type { UploadEntryData } from '../uploadEntrySchema';
import { CollectionStateController } from './CollectionStateController';
import { ConfigController } from './ConfigController';
import type { CollectionObserver, PropertyObserver } from './UploadCollectionController';
import { UploadCollectionController } from './UploadCollectionController';
import { UploadController } from './UploadController';
import { UploadEventsController } from './UploadEventsController';
import { ValidationController } from './ValidationController';

vi.mock('@uploadcare/upload-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uploadcare/upload-client')>();
  return { ...actual, uploadFileGroup: vi.fn() };
});

// `applyInitialCrop` is now an internal method calling this util; mock it so the
// crop-applied assertions have a spy to check (and avoid the real crop-utils).
vi.mock('../applyInitialCrop', () => ({ applyInitialCrop: vi.fn() }));

import { uploadFileGroup } from '@uploadcare/upload-client';
import { applyInitialCrop } from '../applyInitialCrop';

const mockUploadFileGroup = vi.mocked(uploadFileGroup);
const mockApplyInitialCrop = vi.mocked(applyInitialCrop);

type Entry = TypedData<UploadEntryData>;

const makeState = (overrides: Partial<OutputCollectionState> = {}): OutputCollectionState =>
  ({ totalCount: 0, status: 'idle', allEntries: [], ...overrides }) as OutputCollectionState;

const setup = (opts: { collectionState?: OutputCollectionState; deferPlugin?: boolean } = {}) => {
  const container = new ControllerContainer();
  const collection = container.get(UploadCollectionController);
  const config = container.get(ConfigController);
  const collectionState = container.get(CollectionStateController);

  const validation = {
    runFileValidators: vi.fn(),
    runCollectionValidators: vi.fn(),
    cleanupValidationForEntry: vi.fn(),
  } as unknown as ValidationController;
  container.bind(ValidationController, () => validation);
  // The active upload batch now lives on `UploadController` (not a `*uploadTrigger`
  // state key). Back the mock's `uploadBatch` getter with a test-owned set,
  // filtered by existence exactly as the real controller does.
  const uploadBatchSet = new Set<Uid>();
  const upload = {
    buildUploadOptions: vi.fn(async () => ({}) as FileFromOptions),
    get uploadBatch(): Uid[] {
      return [...uploadBatchSet].filter((uid) => !!collection.read(uid));
    },
  } as unknown as UploadController;
  container.bind(UploadController, () => upload);

  // Invoke thunk payloads like the real EventEmitter does, so deferred-payload
  // bodies run. Bound to the per-ctx `EventEmitter` the controller `@injectOrNull`s.
  const emit = vi.fn((_type: unknown, payload?: unknown) => {
    if (typeof payload === 'function') (payload as () => unknown)();
  }) as Mock & EventEmitter['emit'];
  container.bind(EventEmitter, () => ({ emit }) as unknown as EventEmitter);
  const outputCollectionState = opts.collectionState ?? makeState();
  // `getOutputItem`/`getOutputCollectionState` come from the real
  // `UploaderPublicApi` token the controller now `@inject`s; the inlined
  // `getOutputData` derives from `collection.items()` + this `getOutputItem`.
  container.bind(
    UploaderPublicApi,
    () =>
      ({
        getOutputItem: (uid: Uid) => ({ internalId: uid }),
        getOutputCollectionState: () => outputCollectionState,
      }) as unknown as UploaderPublicApi,
  );
  // Plugin `onAdd` hooks fire through the conditionally-bound `PluginController`
  // (`containerOf(this).whenController(...)`), which resolves only a CONSTRUCTED
  // instance — bind a fake and force it into existence (production:
  // `ensurePluginManager`).
  const runOnAddHooks = vi.fn();
  container.bind(PluginController, () => ({ runOnAddHooks }) as unknown as PluginController);
  // Force it into existence so `whenController` fires synchronously — UNLESS a
  // test wants the deferred-waiter path (plugin resolved later), where it must
  // stay unconstructed so `whenController` registers a waiter instead.
  if (!opts.deferPlugin) {
    container.get(PluginController);
  }

  // The six derived collection keys are now written to `CollectionStateController`
  // via `set(key, value)`. Fan the writes out to per-key spies so the original
  // `set<Key>(value)`-shaped assertions still hold, while the real set still runs.
  const setGroupInfo = vi.fn();
  const setUploadList = vi.fn();
  const setCollectionState = vi.fn();
  const setCommonProgress = vi.fn();
  const realSet = collectionState.set.bind(collectionState);
  vi.spyOn(collectionState, 'set').mockImplementation((key, value) => {
    realSet(key, value);
    if (key === 'groupInfo') setGroupInfo(value);
    else if (key === 'uploadList') setUploadList(value);
    else if (key === 'collectionState') setCollectionState(value);
    else if (key === 'commonProgress') setCommonProgress(value);
  });
  // Capture the observer callbacks so tests invoke the handlers directly with
  // controlled (entries, added, removed) / changeMap — no collection debounce.
  let collectionObserver: CollectionObserver = () => {};
  let propertyObserver: PropertyObserver = () => {};
  vi.spyOn(collection, 'observeCollection').mockImplementation((cb) => {
    collectionObserver = cb;
    return () => {};
  });
  vi.spyOn(collection, 'observeProperties').mockImplementation((_keys, cb) => {
    propertyObserver = cb;
    return () => {};
  });

  const controller = container.get(UploadEventsController);
  controller.observe();

  const deps = {
    validation,
    runOnAddHooks,
    applyInitialCrop: mockApplyInitialCrop,
    setGroupInfo,
    setUploadList,
    setCollectionState,
    setCommonProgress,
  };

  return {
    controller,
    container,
    collection,
    config,
    collectionState,
    deps,
    emit,
    uploadBatchSet,
    fireCollection: (entries: Uid[], added: Set<Entry>, removed: Set<Entry>) =>
      collectionObserver(entries, added, removed),
    fireProperties: (changeMap: Parameters<PropertyObserver>[0]) => propertyObserver(changeMap),
    // Simulate the derived collection-state being replaced mid-flight (v1 wrote
    // `*collectionState`) — the group-creation race check reads this back.
    setCollectionStateValue: (s: OutputCollectionState) => {
      collectionState.set('collectionState', s);
    },
  };
};

const entriesByUid = (collection: UploadCollectionController, uids: Uid[]) =>
  new Set(uids.map((id) => collection.read(id)).filter((e): e is Entry => !!e));

describe('UploadEventsController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUploadFileGroup.mockReset();
    mockApplyInitialCrop.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('collection add/remove', () => {
    it('emits FILE_ADDED (non-silent), runs add validators + onAdd hooks, clears groupInfo, sets uploadList', () => {
      const t = setup();
      const id = t.collection.add({ fileName: 'a.txt' });

      t.fireCollection([id], entriesByUid(t.collection, [id]), new Set());

      expect(t.deps.setGroupInfo).toHaveBeenCalledWith(null);
      expect(t.deps.validation.runFileValidators).toHaveBeenCalledWith('add', [id]);
      expect(t.deps.runOnAddHooks).toHaveBeenCalledTimes(1);
      expect(t.deps.validation.runCollectionValidators).toHaveBeenCalled();
      expect(t.emit).toHaveBeenCalledWith(UploaderEventType.FILE_ADDED, expect.objectContaining({ internalId: id }));
      expect(t.deps.setUploadList).toHaveBeenCalledWith([{ uid: id }]);
    });

    it('does not run onAdd hooks against a released scope when PluginController resolves after unobserve', () => {
      // Deferred path: PluginController is unconstructed at add-time, so
      // `whenController` registers a waiter instead of firing synchronously.
      const t = setup({ deferPlugin: true });
      const id = t.collection.add({ fileName: 'a.txt' });

      t.fireCollection([id], entriesByUid(t.collection, [id]), new Set());
      expect(t.deps.runOnAddHooks).not.toHaveBeenCalled(); // waiter pending, not fired

      // Tear down, THEN resolve the plugin manager — the waiter now fires, but
      // the `_active` guard must stop it running hooks against the released scope.
      t.controller.unobserve();
      t.container.get(PluginController);

      expect(t.deps.runOnAddHooks).not.toHaveBeenCalled();
    });

    it('suppresses FILE_ADDED for a silent entry (but still runs onAdd hooks)', () => {
      const t = setup();
      const id = t.collection.add({ fileName: 'a.txt', silent: true });

      t.fireCollection([id], entriesByUid(t.collection, [id]), new Set());

      expect(t.emit).not.toHaveBeenCalledWith(UploaderEventType.FILE_ADDED, expect.anything());
      expect(t.deps.runOnAddHooks).toHaveBeenCalledTimes(1);
    });

    it('on remove: aborts, marks removed, revokes thumbUrl, cleans validation, emits FILE_REMOVED', () => {
      const t = setup();
      const id = t.collection.add({ fileName: 'a.txt', thumbUrl: 'blob:xyz' });
      const entry = t.collection.read(id) as Entry;
      const ac = new AbortController();
      const abortSpy = vi.spyOn(ac, 'abort');
      entry.set('abortController', ac);
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      t.fireCollection([], new Set(), new Set([entry]));

      expect(t.deps.validation.cleanupValidationForEntry).toHaveBeenCalledWith(entry);
      expect(abortSpy).toHaveBeenCalled();
      expect(entry.get('isRemoved')).toBe(true);
      expect(revokeSpy).toHaveBeenCalledWith('blob:xyz');
      expect(t.emit).toHaveBeenCalledWith(UploaderEventType.FILE_REMOVED, expect.objectContaining({ internalId: id }));
    });

    it('does nothing once unobserved (inactive guard)', () => {
      const t = setup();
      const id = t.collection.add({ fileName: 'a.txt' });
      t.controller.unobserve();

      t.fireCollection([id], entriesByUid(t.collection, [id]), new Set());

      expect(t.emit).not.toHaveBeenCalled();
    });

    it('does not reset groupInfo when the update has no adds or removes', () => {
      const t = setup();
      const id = t.collection.add({ fileName: 'a.txt' });

      t.fireCollection([id], new Set(), new Set());

      expect(t.deps.setGroupInfo).not.toHaveBeenCalled();
      expect(t.deps.setUploadList).toHaveBeenCalledWith([{ uid: id }]);
    });

    it('destroy() stops the controller', () => {
      const t = setup();
      const id = t.collection.add({ fileName: 'a.txt' });
      t.controller.destroy();

      t.fireCollection([id], entriesByUid(t.collection, [id]), new Set());

      expect(t.emit).not.toHaveBeenCalled();
    });

    it('handles a removed entry without a thumbUrl', () => {
      const t = setup();
      const id = t.collection.add({ fileName: 'a.txt' }); // no thumbUrl
      const entry = t.collection.read(id) as Entry;
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      t.fireCollection([], new Set(), new Set([entry]));

      expect(revokeSpy).not.toHaveBeenCalled();
      expect(t.emit).toHaveBeenCalledWith(UploaderEventType.FILE_REMOVED, expect.anything());
    });
  });

  describe('property updates → events', () => {
    const addUploadingEntry = (t: ReturnType<typeof setup>, init: Partial<UploadEntryData> = {}) => {
      const id = t.collection.add({ fileName: 'a.txt', isUploading: true, ...init });
      return id;
    };

    it('emits FILE_UPLOAD_PROGRESS for uploading non-silent entries + flushes common progress', () => {
      const t = setup();
      const id = addUploadingEntry(t);
      t.uploadBatchSet.add(id);
      t.collection.publishProp(id, 'uploadProgress', 50);

      t.fireProperties({ uploadProgress: new Set([id]) });

      expect(t.emit).toHaveBeenCalledWith(
        UploaderEventType.FILE_UPLOAD_PROGRESS,
        expect.objectContaining({ internalId: id }),
      );
      expect(t.deps.setCommonProgress).toHaveBeenCalled();
    });

    it('emits FILE_UPLOAD_START only for uploading + non-silent', () => {
      const t = setup();
      const uploading = addUploadingEntry(t);
      const silent = t.collection.add({ isUploading: true, silent: true });

      t.fireProperties({ isUploading: new Set([uploading, silent]) });

      expect(t.emit).toHaveBeenCalledWith(
        UploaderEventType.FILE_UPLOAD_START,
        expect.objectContaining({ internalId: uploading }),
      );
      expect(t.emit).not.toHaveBeenCalledWith(
        UploaderEventType.FILE_UPLOAD_START,
        expect.objectContaining({ internalId: silent }),
      );
    });

    it('emits FILE_UPLOAD_SUCCESS for entries with fileInfo and applies crop when cropPreset set', () => {
      const t = setup();
      t.config.set('cropPreset', '1:1');
      const id = t.collection.add({ fileName: 'a.txt' });
      t.collection.publishProp(id, 'fileInfo', { uuid: 'u1' } as never);

      t.fireProperties({ fileInfo: new Set([id]) });

      expect(t.emit).toHaveBeenCalledWith(
        UploaderEventType.FILE_UPLOAD_SUCCESS,
        expect.objectContaining({ internalId: id }),
      );
      expect(t.deps.applyInitialCrop).toHaveBeenCalled();
    });

    it('emits FILE_UPLOAD_FAILED + debounced COMMON_UPLOAD_FAILED for errored entries', () => {
      const t = setup();
      const id = t.collection.add({ fileName: 'a.txt' });
      t.collection.publishProp(id, 'errors', [{ type: 'X', message: 'm' }] as never);

      t.fireProperties({ errors: new Set([id]) });

      expect(t.deps.validation.runCollectionValidators).toHaveBeenCalled();
      expect(t.emit).toHaveBeenCalledWith(
        UploaderEventType.FILE_UPLOAD_FAILED,
        expect.objectContaining({ internalId: id }),
      );
      expect(t.emit).toHaveBeenCalledWith(UploaderEventType.COMMON_UPLOAD_FAILED, expect.any(Function), {
        debounce: true,
      });
    });

    it('emits COMMON_UPLOAD_SUCCESS when all entries are loaded with no errors', () => {
      const t = setup();
      const id = t.collection.add({ fileName: 'a.txt' });
      t.collection.publishProp(id, 'fileInfo', { uuid: 'u1' } as never);
      // errors changeMap with an entry that has no errors → triggers the success check
      t.fireProperties({ errors: new Set([id]) });

      expect(t.emit).toHaveBeenCalledWith(UploaderEventType.COMMON_UPLOAD_SUCCESS, expect.anything());
    });

    it('emits FILE_URL_CHANGED for entries that now have a cdnUrl and clears groupInfo', () => {
      const t = setup();
      const id = t.collection.add({ fileName: 'a.txt' });
      t.collection.publishProp(id, 'cdnUrl', 'https://cdn/u1/');

      t.fireProperties({ cdnUrl: new Set([id]) });

      expect(t.emit).toHaveBeenCalledWith(
        UploaderEventType.FILE_URL_CHANGED,
        expect.objectContaining({ internalId: id }),
      );
      expect(t.deps.setGroupInfo).toHaveBeenCalledWith(null);
    });

    it('schedules deferred validation for watched-key changes', () => {
      const t = setup();
      const id = t.collection.add({ fileName: 'a.txt' });
      t.collection.publishProp(id, 'fileInfo', { uuid: 'u1' } as never);

      t.fireProperties({ fileInfo: new Set([id]) });
      vi.advanceTimersByTime(1);

      expect(t.deps.validation.runFileValidators).toHaveBeenCalledWith('upload', [id]);
      expect(t.deps.validation.runFileValidators).toHaveBeenCalledWith('change', [id]);
    });

    it('does not emit FILE_UPLOAD_PROGRESS for a non-uploading entry', () => {
      const t = setup();
      const id = t.collection.add({ isUploading: false });
      t.uploadBatchSet.add(id);
      t.collection.publishProp(id, 'uploadProgress', 50);

      t.fireProperties({ uploadProgress: new Set([id]) });

      expect(t.emit).not.toHaveBeenCalledWith(UploaderEventType.FILE_UPLOAD_PROGRESS, expect.anything());
    });

    it('does not apply crop when no cropPreset is configured', () => {
      const t = setup();
      const id = t.collection.add({ fileName: 'a.txt' });
      t.collection.publishProp(id, 'fileInfo', { uuid: 'u1' } as never);

      t.fireProperties({ fileInfo: new Set([id]) });

      expect(t.deps.applyInitialCrop).not.toHaveBeenCalled();
    });

    it('skips FILE_URL_CHANGED for entries that still lack a cdnUrl', () => {
      const t = setup();
      const id = t.collection.add({ fileName: 'a.txt' }); // no cdnUrl set

      t.fireProperties({ cdnUrl: new Set([id]) });

      expect(t.emit).not.toHaveBeenCalledWith(UploaderEventType.FILE_URL_CHANGED, expect.anything());
    });

    it('suppresses FILE_UPLOAD_SUCCESS for a silent entry with fileInfo', () => {
      const t = setup();
      const id = t.collection.add({ fileName: 'a.txt', silent: true });
      t.collection.publishProp(id, 'fileInfo', { uuid: 'u1' } as never);

      t.fireProperties({ fileInfo: new Set([id]) });

      expect(t.emit).not.toHaveBeenCalledWith(UploaderEventType.FILE_UPLOAD_SUCCESS, expect.anything());
    });

    it('skips changeMap ids that have no backing entry (stale uids)', () => {
      const t = setup();
      const ghost = 'ghost' as Uid;

      expect(() =>
        t.fireProperties({
          uploadProgress: new Set([ghost]),
          isUploading: new Set([ghost]),
          fileInfo: new Set([ghost]),
          errors: new Set([ghost]),
        }),
      ).not.toThrow();
      expect(t.emit).not.toHaveBeenCalledWith(UploaderEventType.FILE_UPLOAD_START, expect.anything());
    });

    it('defers only "change" validators for a non-fileInfo watched-key change', () => {
      const t = setup();
      const id = t.collection.add({ fileName: 'a.txt' });

      t.fireProperties({ cdnUrl: new Set([id]) }); // watched key, but not fileInfo
      vi.advanceTimersByTime(1);

      expect(t.deps.validation.runFileValidators).toHaveBeenCalledWith('change', [id]);
      expect(t.deps.validation.runFileValidators).not.toHaveBeenCalledWith('upload', expect.anything());
    });

    it('skips deferred validation if unobserved before the microtask fires', () => {
      const t = setup();
      const id = t.collection.add({ fileName: 'a.txt' });
      t.collection.publishProp(id, 'fileInfo', { uuid: 'u1' } as never);

      t.fireProperties({ fileInfo: new Set([id]) });
      t.controller.unobserve();
      vi.advanceTimersByTime(1);

      expect(t.deps.validation.runFileValidators).not.toHaveBeenCalledWith('change', expect.anything());
    });

    it('ignores a non-numeric uploadProgress when averaging', () => {
      const t = setup();
      const id = t.collection.add({ isUploading: true });
      t.collection.read(id)?.set('uploadProgress', 'oops' as never);
      t.uploadBatchSet.add(id);

      expect(() => t.fireProperties({ uploadProgress: new Set([id]) })).not.toThrow();
    });

    it('tolerates an undefined changeMap value for a watched key', () => {
      const t = setup();
      expect(() => t.fireProperties({ file: undefined } as never)).not.toThrow();
    });

    it('does nothing once unobserved (inactive guard)', () => {
      const t = setup();
      const id = t.collection.add({ isUploading: true });
      t.controller.unobserve();

      t.fireProperties({ isUploading: new Set([id]) });

      expect(t.emit).not.toHaveBeenCalled();
    });
  });

  describe('output flush + group', () => {
    it('flushes collection state + emits CHANGE when output data matches collection size', () => {
      const t = setup({ collectionState: makeState({ totalCount: 1, status: 'idle' }) });
      const id = t.collection.add({ fileName: 'a.txt' });

      t.fireCollection([id], entriesByUid(t.collection, [id]), new Set());
      vi.advanceTimersByTime(300);

      expect(t.deps.setCollectionState).toHaveBeenCalled();
      expect(t.emit).toHaveBeenCalledWith(UploaderEventType.CHANGE, expect.any(Function), { debounce: true });
    });

    it('skips flush when output data length does not match the collection size', () => {
      const t = setup();
      const id = t.collection.add({ fileName: 'a.txt' }); // size 1
      // The flush derives its output list from `collection.items()` and guards
      // on `data.length !== collection.size`. Force a genuine mismatch (items
      // empty while size reports 1) so the defensive early-return is exercised.
      vi.spyOn(t.collection, 'items').mockReturnValue([]);
      (t.deps.setCollectionState as Mock).mockClear();

      t.fireCollection([id], entriesByUid(t.collection, [id]), new Set());
      vi.advanceTimersByTime(300);

      expect(t.deps.setCollectionState).not.toHaveBeenCalled();
    });

    it('creates a group when groupOutput is on and the collection is fully successful', async () => {
      const state = makeState({
        totalCount: 1,
        status: 'success',
        allEntries: [{ uuid: 'u1', cdnUrlModifiers: '-/preview/' }] as never,
      });
      const t = setup({ collectionState: state });
      t.config.set('groupOutput', true);
      mockUploadFileGroup.mockResolvedValue({ uuid: 'group~1' } as UploadcareGroup);
      const id = t.collection.add({ fileName: 'a.txt' });

      t.fireCollection([id], entriesByUid(t.collection, [id]), new Set());
      await vi.advanceTimersByTimeAsync(300);

      expect(mockUploadFileGroup).toHaveBeenCalled();
      expect(t.deps.setGroupInfo).toHaveBeenCalledWith({ uuid: 'group~1' });
      expect(t.emit).toHaveBeenCalledWith(UploaderEventType.GROUP_CREATED, expect.anything());
    });

    it('does not finalize the group if the controller is unobserved mid-flight', async () => {
      const state = makeState({
        totalCount: 1,
        status: 'success',
        allEntries: [{ uuid: 'u1', cdnUrlModifiers: '' }] as never,
      });
      const t = setup({ collectionState: state });
      t.config.set('groupOutput', true);
      mockUploadFileGroup.mockImplementation(async () => {
        t.controller.unobserve(); // host disconnects while the group upload is in-flight
        return { uuid: 'group~1' } as UploadcareGroup;
      });
      const id = t.collection.add({ fileName: 'a.txt' });

      t.fireCollection([id], entriesByUid(t.collection, [id]), new Set());
      await vi.advanceTimersByTimeAsync(300);

      expect(t.deps.setGroupInfo).not.toHaveBeenCalledWith({ uuid: 'group~1' });
      expect(t.emit).not.toHaveBeenCalledWith(UploaderEventType.GROUP_CREATED, expect.anything());
    });

    it('aborts group creation if the collection state changed mid-flight', async () => {
      const state = makeState({
        totalCount: 1,
        status: 'success',
        allEntries: [{ uuid: 'u1', cdnUrlModifiers: '' }] as never,
      });
      const t = setup({ collectionState: state });
      t.config.set('groupOutput', true);
      mockUploadFileGroup.mockImplementation(async () => {
        t.setCollectionStateValue(makeState({ totalCount: 2, status: 'success' })); // race: state replaced
        return { uuid: 'group~1' } as UploadcareGroup;
      });
      const id = t.collection.add({ fileName: 'a.txt' });

      t.fireCollection([id], entriesByUid(t.collection, [id]), new Set());
      await vi.advanceTimersByTimeAsync(300);

      expect(t.deps.setGroupInfo).not.toHaveBeenCalledWith({ uuid: 'group~1' });
      expect(t.emit).not.toHaveBeenCalledWith(UploaderEventType.GROUP_CREATED, expect.anything());
    });
  });

  describe('common upload progress', () => {
    it('averages trigger-entry progress and emits COMMON_UPLOAD_PROGRESS on change', () => {
      const t = setup();
      const a = t.collection.add({ isUploading: true });
      const b = t.collection.add({ isUploading: true });
      t.collection.publishProp(a, 'uploadProgress', 40);
      t.collection.publishProp(b, 'uploadProgress', 60);
      t.uploadBatchSet.add(a);
      t.uploadBatchSet.add(b);

      t.fireProperties({ uploadProgress: new Set([a, b]) });

      expect(t.deps.setCommonProgress).toHaveBeenCalledWith(50);
      expect(t.emit).toHaveBeenCalledWith(UploaderEventType.COMMON_UPLOAD_PROGRESS, expect.anything());
    });

    it('does not re-emit when the rounded progress is unchanged', () => {
      const t = setup();
      const a = t.collection.add({ isUploading: true });
      t.collection.publishProp(a, 'uploadProgress', 0);
      t.uploadBatchSet.add(a);

      // common progress starts at 0; an all-zero average stays 0 → no emit
      t.fireProperties({ uploadProgress: new Set([a]) });

      expect(t.emit).not.toHaveBeenCalledWith(UploaderEventType.COMMON_UPLOAD_PROGRESS, expect.anything());
    });
  });
});
