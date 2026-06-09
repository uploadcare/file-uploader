import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Uid } from '../../lit/Uid';
import type { OutputErrorCollection, UploaderPublicApi } from '../../types';
import { ConfigController } from './ConfigController';
import { UploadCollectionController } from './UploadCollectionController';
import { ValidationController, type ValidationControllerDeps } from './ValidationController';

// The async path runs through a 500ms queue debounce, so the async tests use
// real timers and wait it out rather than choreographing fake timers across
// the upload-client Queue + per-entry promise chain.
const QUEUE_FLUSH_MS = 600;
const flush = (ms = QUEUE_FLUSH_MS) => new Promise((resolve) => setTimeout(resolve, ms));

// Built from the typed entry snapshot — the natural (inferred) shape is used
// directly; the only boundary cast is on the api mock below. A fully
// type-checked `Pick<OutputFileEntry, …>` isn't feasible here: OutputFileEntry's
// field types intentionally differ from the entry's storage (`source` is a
// `SourceTypes` union, `name`/`size` are non-null) — the production
// `getOutputItem` bridges that mismatch with the same cast.
function buildOutputItem(collection: UploadCollectionController, uid: Uid) {
  const entry = collection.read(uid);
  if (!entry) throw new Error(`test fixture: entry "${uid}" not found`);
  const e = entry.snapshot();
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

function setup(opts: Partial<ValidationControllerDeps> = {}) {
  const config = new ConfigController();
  const collection = new UploadCollectionController();
  const setCollectionErrors = vi.fn();
  const emitCommonUploadFailed = vi.fn();
  const onValidatorError = vi.fn();
  // A minimal public-api stand-in. Only the members the controller and the
  // built-in validators touch are implemented; the mock-boundary assertion is
  // unavoidable for a class this large.
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
  const controller = new ValidationController({
    config,
    collection,
    getApi: () => api,
    setCollectionErrors,
    emitCommonUploadFailed,
    onValidatorError,
    ...opts,
  });
  active.push(controller);
  return { controller, config, collection, setCollectionErrors, emitCommonUploadFailed, onValidatorError, api };
}

describe('ValidationController', () => {
  beforeEach(() => {
    active.length = 0;
  });
  afterEach(() => {
    for (const c of active) c.destroy();
    vi.restoreAllMocks();
  });

  it('runs an initial validation pass on construction', async () => {
    const { setCollectionErrors } = setup();
    await flush(20);
    expect(setCollectionErrors).toHaveBeenCalled();
  });

  it('runCollectionValidators reports the built-in multiple (too few) error and fires common-upload-failed', () => {
    const { controller, config, setCollectionErrors, emitCommonUploadFailed } = setup();
    config.set('multiple', true);
    config.set('multipleMin', 2);

    controller.runCollectionValidators();

    const errors: OutputErrorCollection[] = setCollectionErrors.mock.calls.at(-1)?.[0] ?? [];
    expect(errors.some((e) => e.type === 'TOO_FEW_FILES')).toBe(true);
    expect(emitCommonUploadFailed).toHaveBeenCalled();
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
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Missing message/));
  });

  it('runs a custom file validator and writes its (custom-typed) error to the entry', async () => {
    const { controller, config, collection } = setup();
    await flush(20); // drain the constructor's initial pass
    config.set('fileValidators', [() => ({ message: 'nope' })]);
    const id = collection.add({ fileName: 'a.txt', mimeType: 'text/plain', fileSize: 10 });

    controller.runFileValidators('change', [id]);
    await flush();

    const errors = collection.read(id)?.getValue('errors') ?? [];
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

    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/timed out/));
    expect(collection.read(id)?.getValue('isValidationPending')).toBe(false);
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
    expect(collection.read(id)?.getValue('isValidationPending')).toBe(false);
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

    expect(collection.read(id)?.getValue('isValidationPending')).toBe(false);
  });

  it('warns when a file validator returns an error without a message', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { controller, config, collection } = setup();
    await flush(20);
    config.set('fileValidators', [() => ({ type: 'CUSTOM_ERROR', message: '' })]);
    const id = collection.add({ fileName: 'a.txt', mimeType: 'text/plain' });

    controller.runFileValidators('change', [id]);
    await flush();

    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Missing message/));
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

    const errors = collection.read(id)?.getValue('errors') ?? [];
    expect(errors.some((e) => e.message === 'add-err')).toBe(true);
  });

  it('short-circuits a run when destroyed before it settles', async () => {
    const { controller, config, collection } = setup();
    await flush(20);
    config.set('fileValidators', [() => ({ message: 'x' })]);
    const id = collection.add({ fileName: 'a.txt', mimeType: 'text/plain' });

    controller.runFileValidators('change', [id]); // IIFE awaits the (resolved) previous promise
    controller.destroy(); // before the microtask resumes → post-await guard returns
    await flush();

    expect(collection.read(id)?.getValue('isValidationPending')).toBe(false);
  });

  it('syncs queue concurrency from config without throwing', () => {
    const { controller, config } = setup();
    config.set('validationConcurrency', 5);
    expect(() => controller.runFileValidators('change')).not.toThrow();
  });

  it('is inert after destroy', async () => {
    const { controller, collection, setCollectionErrors } = setup();
    await flush(20);
    controller.destroy();
    setCollectionErrors.mockClear();

    const id = collection.add({ fileName: 'a.txt' });
    controller.runFileValidators('change', [id]);
    controller.runCollectionValidators();
    await flush();

    expect(setCollectionErrors).not.toHaveBeenCalled();
  });
});
