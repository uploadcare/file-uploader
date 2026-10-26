import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OutputErrorCollection } from '../../types';
import { ControllerContainer } from '../di/ControllerContainer';
import { EventEmitter, EventType } from '../EventEmitter';
import { TelemetryManager } from '../managers/TelemetryManager';
import type { Uid } from '../Uid';
import { UploaderPublicApi } from '../UploaderPublicApi';
import { CollectionStateController } from './CollectionStateController';
import { ConfigController } from './ConfigController';
import { UploadCollectionController } from './UploadCollectionController';
import { ValidationController } from './ValidationController';

// The async path runs through a 500ms queue debounce; the specs run on fake timers and advance past it.
const QUEUE_FLUSH_MS = 600;
const flush = (ms = QUEUE_FLUSH_MS) => vi.advanceTimersByTimeAsync(ms);

// Built from the typed entry snapshot — the natural (inferred) shape is used
// directly; the only boundary cast is on the api mock below. A fully
// type-checked `Pick<OutputFileEntry, …>` isn't feasible here: OutputFileEntry's
// field types intentionally differ from the entry's storage (`source` is a
// `SourceTypes` union, `name`/`size` are non-null) — the production
// `getOutputItem` bridges that mismatch with the same cast.
function buildOutputItem(collection: UploadCollectionController, uid: Uid) {
  const entry = collection.read(uid);
  if (!entry) throw new Error(`test fixture: entry "${uid}" not found`);
  const e = entry.values;
  const status = e.isRemoved
    ? 'removed'
    : e.errors.length > 0
      ? 'failed'
      : e.fileInfo
        ? 'success'
        : e.isUploading
          ? 'uploading'
          : 'idle';
  return {
    internalId: uid,
    isImage: e.isImage,
    fileInfo: e.fileInfo,
    externalUrl: e.externalUrl,
    mimeType: e.mimeType,
    size: e.fileSize,
    name: e.fileName,
    errors: e.errors,
    uploadProgress: e.uploadProgress,
    status,
    source: e.source,
    uuid: e.uuid,
    cdnUrl: e.cdnUrl,
  };
}

const active: ValidationController[] = [];

function setup(overrides: { onValidatorError?: (error: unknown, context?: string) => void } = {}) {
  const container = new ControllerContainer();
  const config = container.get(ConfigController);
  const collection = container.get(UploadCollectionController);
  const collectionState = container.get(CollectionStateController);
  // A minimal public-api stand-in. Only the members the controller and the
  // built-in validators touch are implemented; the mock-boundary assertion is
  // unavoidable for a class this large. Bound to the real `UploaderPublicApi`
  // token the controller now `@inject`s directly.
  const api = {
    cfg: config.values,
    l10n: (key: string) => key,
    _uploadCollection: collection, // `validateUploadError` reads this
    getOutputItem: (uid: Uid) => buildOutputItem(collection, uid),
    getOutputCollectionState: () => ({
      totalCount: collection.size,
      allEntries: collection.items().map((id) => buildOutputItem(collection, id)),
    }),
  } as unknown as UploaderPublicApi;
  container.bind(UploaderPublicApi, () => api);
  // `common-upload-failed` is emitted through the per-ctx `EventEmitter` the
  // controller `@inject`s; bind a fake with an `emit` spy so the old
  // `emitCommonUploadFailed` assertions become "emit fired with that type".
  const emit = vi.fn();
  container.bind(EventEmitter, () => ({ emit }) as unknown as EventEmitter);
  // Validator errors report to `TelemetryManager.sendEventError` (the never-
  // throwing sink); spy it. A test may install a throwing impl to prove the
  // controller's own catch swallows a pathological sink.
  const onValidatorError = vi
    .spyOn(container.get(TelemetryManager), 'sendEventError')
    .mockImplementation(overrides.onValidatorError ?? (() => {}));
  // The collection-errors sink is a direct `CollectionStateController.set` write;
  // spy on it so the old `setCollectionErrors` assertions (called / last value)
  // still hold. `set('collectionErrors', errors)` → value at index [1].
  const setCollectionErrors = vi.spyOn(collectionState, 'set');
  const controller = container.get(ValidationController);
  active.push(controller);
  return {
    container,
    controller,
    config,
    collection,
    collectionState,
    setCollectionErrors,
    emit,
    onValidatorError,
    api,
  };
}

describe('ValidationController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    active.length = 0;
  });
  afterEach(() => {
    for (const c of active) c.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('runs an initial validation pass on construction', async () => {
    const { setCollectionErrors } = setup();
    await flush(20);
    expect(setCollectionErrors).toHaveBeenCalled();
  });

  it('runCollectionValidators reports the built-in multiple (too few) error and fires common-upload-failed', () => {
    const { controller, config, collectionState, emit } = setup();
    config.set('multiple', true);
    config.set('multipleMin', 2);

    controller.runCollectionValidators();

    const errors: OutputErrorCollection[] = collectionState.get('collectionErrors');
    expect(errors.some((e) => e.type === 'TOO_FEW_FILES')).toBe(true);
    expect(emit).toHaveBeenCalledWith(EventType.COMMON_UPLOAD_FAILED, expect.any(Function), { debounce: true });
  });

  it('runCollectionValidators isolates a throwing custom collection validator and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { controller, config, setCollectionErrors } = setup();
    config.set('collectionValidators', [
      () => {
        throw new Error('boom');
      },
    ]);

    expect(() => controller.runCollectionValidators()).not.toThrow();
    expect(setCollectionErrors).toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('warns when a custom collection validator returns an error without a message', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { controller, config } = setup();
    // Deliberately omits `message` to exercise the warning path.
    config.set('collectionValidators', [() => ({ type: 'CUSTOM_ERROR', message: '' })]);

    controller.runCollectionValidators();
    expect(warn).toHaveBeenCalledWith('[uc][validation]', expect.stringMatching(/Missing message/));
  });

  it('runs a custom file validator and writes its (custom-typed) error to the entry', async () => {
    const { controller, config, collection } = setup();
    await flush(20); // drain the constructor's initial pass
    config.set('fileValidators', [() => ({ message: 'nope' })]);
    const id = collection.add({ fileName: 'a.txt', mimeType: 'text/plain', fileSize: 10 });

    controller.runFileValidators('change', [id]);
    await flush();

    const errors = collection.read(id)?.get('errors') ?? [];
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ message: 'nope', type: 'CUSTOM_ERROR' });
  });

  it('runOn:add validators only fire on add, not on change', async () => {
    const validator = vi.fn(() => undefined);
    const { controller, config, collection } = setup();
    await flush(20);
    config.set('fileValidators', [{ runOn: 'add', validator }]);
    const id = collection.add({ fileName: 'a.txt', mimeType: 'text/plain' });

    controller.runFileValidators('change', [id]);
    await flush();
    expect(validator).not.toHaveBeenCalled();

    controller.runFileValidators('add', [id]);
    await flush();
    expect(validator).toHaveBeenCalledTimes(1);
  });

  it('aborts a hung validator after validationTimeout and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { controller, config, collection } = setup();
    await flush(20);
    config.set('validationTimeout', 50);
    // A realistic validator that respects the abort signal: the timeout aborts
    // it, so the run can settle (isValidationPending cleared).
    config.set('fileValidators', [
      (_entry, _api, opts) =>
        new Promise<undefined>((_resolve, reject) => {
          opts?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    ]);
    const id = collection.add({ fileName: 'a.txt', mimeType: 'text/plain' });

    controller.runFileValidators('change', [id]);
    await flush(800); // 500 debounce + 50 timeout + margin

    expect(warn).toHaveBeenCalledWith('[uc][validation]', expect.stringMatching(/timed out/));
    expect(collection.read(id)?.get('isValidationPending')).toBe(false);
  });

  it('settles after validationTimeout even when the validator ignores its signal', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { controller, config, collection } = setup();
    await flush(20);
    config.set('validationTimeout', 50);
    config.set('fileValidators', [() => new Promise<undefined>(() => {})]);
    const id = collection.add({ fileName: 'a.txt', mimeType: 'text/plain' });

    controller.runFileValidators('change', [id]);
    await flush(800);

    expect(collection.read(id)?.get('isValidationPending')).toBe(false);
  });

  it("keeps the other validators' errors when one times out", async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { controller, config, collection } = setup();
    await flush(20);
    config.set('validationTimeout', 50);
    config.set('fileValidators', [
      () => ({ message: 'nope' }),
      (_entry, _api, opts) =>
        new Promise<undefined>((_resolve, reject) => {
          opts?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    ]);
    const id = collection.add({ fileName: 'a.txt', mimeType: 'text/plain' });

    controller.runFileValidators('change', [id]);
    await flush(800);

    expect(collection.read(id)?.get('errors')).toMatchObject([{ message: 'nope' }]);
  });

  it('isolates a throwing async validator (reports via onValidatorError) without crashing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { controller, config, collection, onValidatorError } = setup();
    await flush(20);
    config.set('fileValidators', [
      () => {
        throw new Error('validator boom');
      },
    ]);
    const id = collection.add({ fileName: 'a.txt', mimeType: 'text/plain' });

    controller.runFileValidators('change', [id]);
    await flush();

    expect(onValidatorError).toHaveBeenCalled();
    expect(collection.read(id)?.get('isValidationPending')).toBe(false);
  });

  describe('which validators run again for the same entry', () => {
    const runTwice = async (runOn: 'add' | 'upload' | 'change', validator: () => unknown) => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { controller, config, collection } = setup();
      await flush(20);
      config.set('validationTimeout', 50);
      config.set('fileValidators', [{ runOn, validator: validator as never }]);
      const id = collection.add({ fileName: 'a.txt', mimeType: 'text/plain' });
      for (let i = 0; i < 2; i++) {
        controller.runFileValidators(runOn, [id]);
        await flush(800);
      }
    };

    it('runs a passing "change" validator on every change', async () => {
      const validator = vi.fn(() => undefined);
      await runTwice('change', validator);
      expect(validator).toHaveBeenCalledTimes(2);
    });

    it('runs an "add" or "upload" validator once', async () => {
      const onAdd = vi.fn(() => undefined);
      const onUpload = vi.fn(() => undefined);
      await runTwice('add', onAdd);
      await runTwice('upload', onUpload);
      expect([onAdd.mock.calls.length, onUpload.mock.calls.length]).toEqual([1, 1]);
    });

    it('does not run a validator again after it timed out', async () => {
      const validator = vi.fn(() => new Promise<undefined>(() => {}));
      await runTwice('change', validator);
      expect(validator).toHaveBeenCalledTimes(1);
    });

    it('does not run a validator again after it threw', async () => {
      const validator = vi.fn(() => {
        throw new Error('boom');
      });
      await runTwice('change', validator);
      expect(validator).toHaveBeenCalledTimes(1);
    });
  });

  it('cleanupValidationForEntry aborts in-flight validation and is a no-op without state', async () => {
    const { controller, config, collection } = setup();
    await flush(20);
    config.set('fileValidators', [() => new Promise<undefined>(() => {})]);
    const id = collection.add({ fileName: 'a.txt', mimeType: 'text/plain' });
    const entry = collection.read(id);
    if (!entry) throw new Error('no entry');

    controller.runFileValidators('change', [id]);
    await flush();

    expect(() => controller.cleanupValidationForEntry(entry)).not.toThrow();
    expect(() => controller.cleanupValidationForEntry(entry)).not.toThrow(); // no state now
  });

  describe('whenValidated', () => {
    const track = (promise: Promise<void>) => {
      const result = {
        settled: false,
        done: promise.then(() => {
          result.settled = true;
        }),
      };
      return result;
    };

    const addEntry = (collection: UploadCollectionController) => {
      const id = collection.add({ fileName: 'a.txt', mimeType: 'text/plain' });
      const entry = collection.read(id);
      if (!entry) throw new Error('no entry');
      return { id, entry };
    };

    it("settles only once the entry's first add and change runs have finished", async () => {
      const { controller, collection } = setup();
      await flush(20);
      const { id, entry } = addEntry(collection);
      const wait = track(controller.whenValidated(entry));

      controller.runFileValidators('add', [id]);
      await flush();
      expect(wait.settled).toBe(false);

      controller.runFileValidators('change', [id]);
      await flush();
      expect(wait.settled).toBe(true);
      await wait.done;
    });

    it('waits for a run queued after the first pass', async () => {
      const { controller, config, collection } = setup();
      await flush(20);
      const { id, entry } = addEntry(collection);
      controller.runFileValidators('add', [id]);
      controller.runFileValidators('change', [id]);
      await flush();

      let finish = () => {};
      config.set('fileValidators', [
        () =>
          new Promise<undefined>((resolve) => {
            finish = () => resolve(undefined);
          }),
      ]);
      controller.runFileValidators('change', [id]);
      const wait = track(controller.whenValidated(entry));
      await flush();
      expect(wait.settled).toBe(false);

      finish();
      await wait.done;
    });

    it('settles when the entry is cleaned up before its first pass', async () => {
      const { controller, collection } = setup();
      await flush(20);
      const { entry } = addEntry(collection);
      const wait = track(controller.whenValidated(entry));

      controller.cleanupValidationForEntry(entry);
      await wait.done;
    });

    it('settles when the controller is destroyed before the first pass', async () => {
      const { controller, collection } = setup();
      await flush(20);
      const { entry } = addEntry(collection);
      const wait = track(controller.whenValidated(entry));

      controller.destroy();
      await wait.done;
    });
  });

  it('re-runs validators when a relevant config key changes', async () => {
    const { config, collection, setCollectionErrors } = setup();
    await flush(20);
    collection.add({ fileName: 'a.txt', mimeType: 'text/plain' });
    setCollectionErrors.mockClear();

    config.set('multiple', true);
    config.set('multipleMax', 0);
    await flush(20);

    expect(setCollectionErrors).toHaveBeenCalled();
  });

  it('returns early when no validators match the runOn phase', async () => {
    const { controller, collection } = setup();
    await flush(20);
    const id = collection.add({ fileName: 'a.txt', mimeType: 'text/plain' });

    // 'upload' phase with no upload validators (built-ins are 'change') → empty.
    controller.runFileValidators('upload', [id]);
    await flush();

    expect(collection.read(id)?.get('isValidationPending')).toBe(false);
  });

  it('warns when a file validator returns an error without a message', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { controller, config, collection } = setup();
    await flush(20);
    config.set('fileValidators', [() => ({ type: 'CUSTOM_ERROR', message: '' })]);
    const id = collection.add({ fileName: 'a.txt', mimeType: 'text/plain' });

    controller.runFileValidators('change', [id]);
    await flush();

    expect(warn).toHaveBeenCalledWith('[uc][validation]', expect.stringMatching(/Missing message/));
  });

  it('carries over an error from a validator not run in the current phase', async () => {
    const { controller, config, collection } = setup();
    await flush(20);
    config.set('fileValidators', [{ runOn: 'add', validator: () => ({ message: 'add-err' }) }]);
    const id = collection.add({ fileName: 'a.txt', mimeType: 'text/plain' });

    controller.runFileValidators('add', [id]); // add validator errors → remembered
    await flush();
    controller.runFileValidators('change', [id]); // add validator filtered out → error carried
    await flush();

    const errors = collection.read(id)?.get('errors') ?? [];
    expect(errors.some((e) => e.message === 'add-err')).toBe(true);
  });

  it('short-circuits a run when the ctx is disposed before it settles', async () => {
    const { container, controller, config, collection } = setup();
    await flush(20);
    const validator = vi.fn(() => ({ message: 'x' }));
    config.set('fileValidators', [validator]);
    const id = collection.add({ fileName: 'a.txt', mimeType: 'text/plain' });
    // The disposed collection releases its entries, so watch the writes rather than read the entry back.
    const setMany = vi.spyOn(collection.read(id)!, 'setMany');

    controller.runFileValidators('change', [id]); // IIFE awaits the (resolved) previous promise
    container.dispose(); // before the microtask resumes → post-await guard returns
    await flush();

    expect(setMany).not.toHaveBeenCalledWith(expect.objectContaining({ isValidationPending: true }));
    expect(validator).not.toHaveBeenCalled();
  });

  it('syncs queue concurrency from config without throwing', () => {
    const { controller, config } = setup();
    config.set('validationConcurrency', 5);
    expect(() => controller.runFileValidators('change')).not.toThrow();
  });

  it('falls back to concurrency 20 when validationConcurrency is not positive', () => {
    const { controller, config } = setup();
    const queue = (controller as unknown as { _queue: { concurrency: number } })._queue;
    config.set('validationConcurrency', 5);
    expect(queue.concurrency).toBe(5);
    // A non-positive value re-runs `_concurrencyFromConfig`'s `: 20` fallback.
    config.set('validationConcurrency', 0);
    expect(queue.concurrency).toBe(20);
  });

  it('skips ids with no backing entry (stale uid) in runFileValidators', () => {
    const { controller } = setup();
    // `read()` returns null for a stale id → the `if (entry)` guard skips it.
    expect(() => controller.runFileValidators('change', ['ghost' as Uid])).not.toThrow();
  });

  it('swallows a telemetry sink that itself throws while reporting a validator error', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // `onValidatorError` throwing makes the per-task catch handler reject; the run
    // waits for every task and logs that rejection — no unhandled crash.
    const { controller, config, collection } = setup({
      onValidatorError: () => {
        throw new Error('telemetry boom');
      },
    });
    await flush(20);
    config.set('fileValidators', [
      () => {
        throw new Error('validator boom');
      },
    ]);
    const id = collection.add({ fileName: 'a.txt', mimeType: 'text/plain' });

    controller.runFileValidators('change', [id]);
    await flush();

    expect(collection.read(id)?.get('isValidationPending')).toBe(false);
  });

  it('logs a failure that escapes a validator task, and still settles the entry', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { controller, config, collection } = setup({
      onValidatorError: () => {
        throw new Error('telemetry boom');
      },
    });
    await flush(20);
    config.set('fileValidators', [
      () => {
        throw new Error('validator boom');
      },
      () => ({ message: 'nope' }),
    ]);
    const id = collection.add({ fileName: 'a.txt', mimeType: 'text/plain' });

    controller.runFileValidators('change', [id]);
    await flush();

    expect(warn).toHaveBeenCalledWith(
      '[uc][validation]',
      'File validator execution has failed',
      expect.objectContaining({ message: 'telemetry boom' }),
    );
    expect(collection.read(id)?.get('errors')).toMatchObject([{ message: 'nope' }]);
  });

  it('is inert after the ctx is disposed', async () => {
    const { container, controller, collection, setCollectionErrors } = setup();
    await flush(20);
    const id = collection.add({ fileName: 'a.txt' });
    container.dispose();
    setCollectionErrors.mockClear();

    controller.runFileValidators('change', [id]);
    controller.runCollectionValidators();
    await flush();

    expect(setCollectionErrors).not.toHaveBeenCalled();
  });
});
