import { CancelError, UploadcareError, type UploadcareFile, uploadFile } from '@uploadcare/upload-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigType } from '../../types';
import { ControllerContainer, containerOf } from '../di/ControllerContainer';
import { UploaderEventType } from '../EventBus';
import { EventEmitter } from '../EventEmitter';
import { __resetLoggerForTests } from '../logger';
import { PluginController } from '../managers/plugin';
import type { Owned, PluginFileHookRegistration } from '../managers/plugin/PluginTypes';
import { TelemetryManager } from '../managers/TelemetryManager';
import type { Uid } from '../Uid';
import type { UploadEntryData } from '../uploadEntrySchema';
import { ConfigController } from './ConfigController';
import { SecureUploadsController } from './SecureUploadsController';
import { UploadCollectionController } from './UploadCollectionController';
import { UploadController } from './UploadController';
import { ValidationController } from './ValidationController';

vi.mock('@uploadcare/upload-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uploadcare/upload-client')>();
  return { ...actual, uploadFile: vi.fn() };
});

const mockUploadFile = vi.mocked(uploadFile);

type FileHook = Owned<PluginFileHookRegistration>;

// See SecureUploadsController.test — correlated-union write widened at this boundary.
const applyConfig = (config: ConfigController, overrides: Partial<ConfigType>): void => {
  for (const key of Object.keys(overrides) as (keyof ConfigType)[]) {
    const value = overrides[key];
    if (value !== undefined) {
      config.set(key, value as ConfigType[keyof ConfigType]);
    }
  }
};

// Minimal UploadcareFile stand-in — only the fields the success write-back reads.
const makeFileInfo = (overrides: Partial<UploadcareFile> = {}): UploadcareFile =>
  ({
    uuid: 'srv-uuid',
    originalFilename: 'server.png',
    size: 999,
    isImage: true,
    mimeType: 'image/png',
    cdnUrl: 'https://cdn.example/srv-uuid/',
    contentInfo: undefined,
    ...overrides,
  }) as UploadcareFile;

const makeHook = (overrides: Partial<FileHook> = {}): FileHook =>
  ({
    type: 'beforeUpload',
    pluginId: 'p1',
    timeout: 30000,
    handler: ({ file }) => ({ file }),
    ...overrides,
  }) as FileHook;

// A bare public output entry — only what the `metadata` callback receives.

type SetupOpts = {
  cfg?: Partial<ConfigType>;
  hooks?: readonly FileHook[];
  whenValidated?: () => Promise<void>;
};

const setup = (opts: SetupOpts = {}) => {
  const container = new ControllerContainer();
  const config = container.get(ConfigController);
  applyConfig(config, opts.cfg ?? {});
  const collection = container.get(UploadCollectionController);
  // `beforeUpload` hooks come from the conditionally-bound `PluginController`
  // (resolved via `containerOf` + `getOrNull`); upload errors report to
  // `TelemetryManager`. Bind a fake for each on the real container so `@inject`
  // resolves them as production.
  const getFileHooks = vi.fn<() => readonly FileHook[]>(() => opts.hooks ?? []);
  container.bind(
    PluginController,
    () => ({ snapshot: () => ({ fileHooks: getFileHooks() }) }) as unknown as PluginController,
  );
  // `getOrNull(PluginController)` (the controller's read path) resolves only a
  // CONSTRUCTED instance, so force the fake into existence — the production
  // equivalent is `ensurePluginManager`'s `container.get(PluginController)`.
  container.get(PluginController);
  // Validation is its own controller with its own spec: here every entry counts as validated unless a test says not.
  const whenValidated = vi.fn(opts.whenValidated ?? (() => Promise.resolve()));
  container.bind(ValidationController, () => ({ whenValidated }) as unknown as ValidationController);
  const onUploadError = vi.spyOn(container.get(TelemetryManager), 'sendEventError').mockImplementation(() => {});
  const secureUploads = container.get(SecureUploadsController);
  const controller = container.get(UploadController);
  return {
    container,
    controller,
    config,
    collection,
    secureUploads,
    getFileHooks,
    onUploadError,
    whenValidated,
  };
};

const queueConcurrency = (controller: UploadController): number =>
  (controller as unknown as { _queue: { concurrency: number } })._queue.concurrency;

describe('UploadController', () => {
  beforeEach(() => {
    mockUploadFile.mockReset();
    mockUploadFile.mockResolvedValue(makeFileInfo());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    __resetLoggerForTests();
  });

  it('passes the auth token and skips the legacy signature resolver', async () => {
    const { controller, secureUploads } = setup({ cfg: { authToken: 'jwt-token', secureSignature: 'legacy' } });
    const legacy = vi.spyOn(secureUploads, 'getSecureToken');
    const options = await controller.buildUploadOptions();
    expect(options.authToken).toBe('jwt-token');
    expect(options.secureSignature).toBeUndefined();
    expect(legacy).not.toHaveBeenCalled();
  });

  describe('preconditions (no upload)', () => {
    it('returns when the entry does not exist', async () => {
      const { controller } = setup();
      await controller.uploadEntry('missing' as Uid);
      expect(mockUploadFile).not.toHaveBeenCalled();
    });

    const preconditionCases: Array<[string, Partial<UploadEntryData>]> = [
      ['already has fileInfo', { fileInfo: makeFileInfo() }],
      ['already uploading', { isUploading: true }],
      ['has errors', { errors: [{ type: 'X', message: 'm' }] as unknown as UploadEntryData['errors'] }],
      ['validation pending', { isValidationPending: true }],
      ['its upload already failed', { uploadError: new Error('failed') }],
    ];
    it.each(preconditionCases)('returns when %s', async (_label, init) => {
      const { controller, collection } = setup();
      const id = collection.add({ file: new File(['x'], 'a.txt'), ...init });
      await controller.uploadEntry(id);
      expect(mockUploadFile).not.toHaveBeenCalled();
    });

    it('returns when the collection exceeds the single-file max', async () => {
      const { controller, collection } = setup({ cfg: { multiple: false } });
      collection.add({ file: new File(['x'], 'a.txt') });
      const id = collection.add({ file: new File(['y'], 'b.txt') }); // size 2 > max 1
      await controller.uploadEntry(id);
      expect(mockUploadFile).not.toHaveBeenCalled();
    });

    it('skips the max guard when multipleMax is 0 (unlimited)', async () => {
      const { controller, collection } = setup({ cfg: { multiple: true, multipleMax: 0 } });
      collection.add({ file: new File(['x'], 'a.txt') });
      const id = collection.add({ file: new File(['y'], 'b.txt') });
      await controller.uploadEntry(id);
      expect(mockUploadFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('waiting for validation', () => {
    it("starts the upload only once the entry's validators have run", async () => {
      let validated = () => {};
      const { controller, collection, whenValidated } = setup({
        whenValidated: () =>
          new Promise<void>((resolve) => {
            validated = resolve;
          }),
      });
      const id = collection.add({ file: new File(['x'], 'a.txt') });

      const upload = controller.uploadEntry(id);
      await Promise.resolve();
      expect(whenValidated).toHaveBeenCalledWith(collection.read(id));
      expect(mockUploadFile).not.toHaveBeenCalled();

      validated();
      await upload;
      expect(mockUploadFile).toHaveBeenCalledTimes(1);
    });

    it('does not upload a file its validators rejected', async () => {
      const { controller, collection } = setup({
        whenValidated: async () => {
          collection.read(id)?.set('errors', [{ type: 'CUSTOM_ERROR', message: 'nope' }]);
        },
      });
      const id = collection.add({ file: new File(['x'], 'a.txt') });

      await controller.uploadEntry(id);
      expect(mockUploadFile).not.toHaveBeenCalled();
    });

    it('does not upload a file removed while its validators ran', async () => {
      const { controller, collection } = setup({
        whenValidated: async () => {
          collection.remove(id);
        },
      });
      const id = collection.add({ file: new File(['x'], 'a.txt') });

      await controller.uploadEntry(id);
      expect(mockUploadFile).not.toHaveBeenCalled();
    });

    it('uploads once when asked twice while the validators run', async () => {
      let validated = () => {};
      const pending = new Promise<void>((resolve) => {
        validated = resolve;
      });
      const { controller, collection } = setup({ whenValidated: () => pending });
      const id = collection.add({ file: new File(['x'], 'a.txt') });

      const uploads = [controller.uploadEntry(id), controller.uploadEntry(id)];
      validated();
      await Promise.all(uploads);
      expect(mockUploadFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('happy path', () => {
    it('uploads a File and writes the success state back to the entry', async () => {
      mockUploadFile.mockResolvedValue(
        makeFileInfo({ uuid: 'u1', originalFilename: 'srv.png', size: 10, cdnUrl: 'https://cdn/u1/' }),
      );
      const { controller, collection } = setup();
      const id = collection.add({ file: new File(['x'], 'a.txt'), fileName: 'a.txt', source: 'local' });

      await controller.uploadEntry(id);

      const entry = collection.read(id);
      expect(entry?.get('fileInfo')).toMatchObject({ uuid: 'u1' });
      expect(entry?.get('isUploading')).toBe(false);
      expect(entry?.get('isQueuedForUploading')).toBe(false);
      expect(entry?.get('uuid')).toBe('u1');
      expect(entry?.get('uploadProgress')).toBe(100);
      expect(entry?.get('cdnUrl')).toBe('https://cdn/u1/');
    });

    it.each([
      ['succeeds', () => mockUploadFile.mockResolvedValue(makeFileInfo())],
      ['fails', () => mockUploadFile.mockRejectedValue(new Error('network'))],
    ])('leaves no abort listener on the ctx lifetime once an upload %s', async (_, arrange) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      arrange();
      const { container, controller, collection } = setup();
      const signal = container.lifetime.signal;
      const add = vi.spyOn(signal, 'addEventListener');
      const remove = vi.spyOn(signal, 'removeEventListener');
      const id = collection.add({ file: new File(['x'], 'a.txt') });

      await controller.uploadEntry(id);

      const added = add.mock.calls.filter(([type]) => type === 'abort').map(([, listener]) => listener);
      const removed = remove.mock.calls.filter(([type]) => type === 'abort').map(([, listener]) => listener);
      expect(added).toHaveLength(1);
      expect(removed).toEqual(added);
    });

    it('emits FILE_UPLOAD_START as the upload starts, not when the collection reports it', async () => {
      // The collection reports changes in batches; an upload that finishes inside one would never be seen starting.
      const { container, controller, collection } = setup();
      const emit = vi.spyOn(container.get(EventEmitter), 'emit');
      const id = collection.add({ file: new File(['x'], 'a.txt') });
      const silent = collection.add({ file: new File(['x'], 'b.txt'), silent: true });
      let startedBeforeRequest = false;
      mockUploadFile.mockImplementation(async () => {
        startedBeforeRequest = emit.mock.calls.some(([type]) => type === UploaderEventType.FILE_UPLOAD_START);
        return makeFileInfo();
      });

      await controller.uploadEntry(id);
      await controller.uploadEntry(silent);

      expect(startedBeforeRequest).toBe(true);
      const starts = emit.mock.calls.filter(([type]) => type === UploaderEventType.FILE_UPLOAD_START);
      expect(starts).toEqual([[UploaderEventType.FILE_UPLOAD_START, expect.objectContaining({ internalId: id })]]);
    });

    it('prefers an existing entry cdnUrl over the server one', async () => {
      mockUploadFile.mockResolvedValue(makeFileInfo({ cdnUrl: 'https://cdn/server/' }));
      const { controller, collection } = setup();
      const id = collection.add({ file: new File(['x'], 'a.txt'), cdnUrl: 'https://cdn/preset/' });

      await controller.uploadEntry(id);

      expect(collection.read(id)?.get('cdnUrl')).toBe('https://cdn/preset/');
    });

    it('derives mimeType from contentInfo when present, falls back to isImage=false', async () => {
      mockUploadFile.mockResolvedValue(
        makeFileInfo({
          isImage: undefined,
          mimeType: 'application/octet-stream',
          contentInfo: { mime: { mime: 'image/webp' } },
        } as Partial<UploadcareFile>),
      );
      const { controller, collection } = setup();
      const id = collection.add({ file: new File(['x'], 'a.txt') });

      await controller.uploadEntry(id);

      const entry = collection.read(id);
      expect(entry?.get('mimeType')).toBe('image/webp');
      expect(entry?.get('isImage')).toBe(false);
    });

    it('uploads from externalUrl when there is no file', async () => {
      const { controller, collection } = setup();
      const id = collection.add({ externalUrl: 'https://example.com/x.png' });

      await controller.uploadEntry(id);

      expect(mockUploadFile).toHaveBeenCalledWith('https://example.com/x.png', expect.any(Object));
    });

    it('uploads from uuid when there is neither file nor externalUrl', async () => {
      const { controller, collection } = setup();
      const id = collection.add({ uuid: 'existing-uuid' });

      await controller.uploadEntry(id);

      expect(mockUploadFile).toHaveBeenCalledWith('existing-uuid', expect.any(Object));
    });

    it('passes fileName/source/metadata through to the upload-client options', async () => {
      const { controller, collection } = setup({ cfg: { metadata: { foo: 'bar' } } });
      const id = collection.add({ file: new File(['x'], 'a.txt'), fileName: 'a.txt', source: 'local' });

      await controller.uploadEntry(id);

      expect(mockUploadFile).toHaveBeenCalledWith(
        expect.any(File),
        expect.objectContaining({ fileName: 'a.txt', source: 'local', metadata: { foo: 'bar' } }),
      );
    });
  });

  describe('uploadEntries / active batch', () => {
    it('uploads every uid and exposes them as the active batch', async () => {
      vi.useFakeTimers();
      const { controller, collection } = setup({ cfg: { multiple: true, multipleMax: 0 } });
      const a = collection.add({ file: new File(['a'], 'a.txt') });
      const b = collection.add({ file: new File(['b'], 'b.txt') });

      controller.uploadEntries([a, b]);

      // The batch is populated synchronously; each upload starts once its entry is validated.
      expect([...controller.uploadBatch].sort()).toEqual([a, b].sort());
      await vi.runAllTimersAsync();
      expect(mockUploadFile).toHaveBeenCalledTimes(2);
    });

    it('excludes removed entries from the active batch', () => {
      // Fake timers so the started `uploadEntry` calls don't leak into later tests.
      vi.useFakeTimers();
      const { controller, collection } = setup({ cfg: { multiple: true, multipleMax: 0 } });
      const a = collection.add({ file: new File(['a'], 'a.txt') });
      const b = collection.add({ file: new File(['b'], 'b.txt') });
      controller.uploadEntries([a, b]);

      collection.remove(a);
      expect(controller.uploadBatch).toEqual([b]);
    });
  });

  describe('progress', () => {
    it('writes uploadProgress when the progress event is computable', async () => {
      mockUploadFile.mockImplementation(async (_input, options) => {
        options?.onProgress?.({ isComputable: true, value: 0.42 });
        return makeFileInfo();
      });
      const { controller, collection } = setup();
      const id = collection.add({ file: new File(['x'], 'a.txt') });

      // Capture progress before the final 100 write.
      const seen: number[] = [];
      const entry = collection.read(id);
      entry?.observe(
        'uploadProgress',
        (v) => {
          if (v !== undefined) seen.push(v);
        },
        { immediate: true },
      );

      await controller.uploadEntry(id);

      expect(seen).toContain(42);
    });

    it('ignores a non-computable progress event', async () => {
      mockUploadFile.mockImplementation(async (_input, options) => {
        options?.onProgress?.({ isComputable: false });
        return makeFileInfo();
      });
      const { controller, collection } = setup();
      const id = collection.add({ file: new File(['x'], 'a.txt') });
      const seen: number[] = [];
      collection.read(id)?.observe(
        'uploadProgress',
        (v) => {
          if (v !== undefined) seen.push(v);
        },
        { immediate: true },
      );

      await controller.uploadEntry(id);

      // Only the final success write (100); no mid-flight value from the event.
      expect(seen.filter((v) => v !== 0 && v !== 100)).toHaveLength(0);
    });
  });

  describe('beforeUpload hooks', () => {
    // Read while the upload call is in flight: its success write-back replaces these fields with the server's.
    const fieldsAtUpload = (collection: UploadCollectionController, id: Uid) => {
      let seen: unknown[] = [];
      mockUploadFile.mockImplementationOnce(async () => {
        const entry = collection.read(id);
        seen = [entry?.get('fileName'), entry?.get('mimeType'), entry?.get('isImage'), entry?.get('fileSize')];
        return makeFileInfo();
      });
      return () => seen;
    };

    it('uploads the file a hook returns and re-derives the entry fields from it', async () => {
      const replaced = new File(['replaced!'], 'b.png', { type: 'image/png' });
      const { controller, collection } = setup({ hooks: [makeHook({ handler: () => ({ file: replaced }) })] });
      const id = collection.add({ file: new File(['x'], 'a.txt', { type: 'text/plain' }), fileName: 'a.txt' });
      const seen = fieldsAtUpload(collection, id);

      await controller.uploadEntry(id);

      expect(mockUploadFile.mock.calls[0]?.[0]).toBe(replaced);
      expect(seen()).toEqual(['b.png', 'image/png', true, replaced.size]);
    });

    it('keeps the file name when a hook returns a Blob, which has none', async () => {
      const blob = new Blob(['blob'], { type: '' });
      const { controller, collection } = setup({ hooks: [makeHook({ handler: () => ({ file: blob }) })] });
      const id = collection.add({ file: new File(['x'], 'a.txt', { type: 'text/plain' }), fileName: 'a.txt' });
      const seen = fieldsAtUpload(collection, id);

      await controller.uploadEntry(id);

      expect(seen()).toEqual(['a.txt', null, false, 4]);
    });

    it('invokes no further hook and uploads nothing once the ctx is disposed mid-hook', async () => {
      let finishFirst: (() => void) | undefined;
      const second = vi.fn(({ file }: { file: File | Blob }) => ({ file }));
      const { container, controller, collection } = setup({
        hooks: [
          makeHook({ handler: ({ file }) => new Promise((resolve) => (finishFirst = () => resolve({ file }))) }),
          makeHook({ handler: second }),
        ],
      });
      const id = collection.add({ file: new File(['x'], 'a.txt') });

      const pending = controller.uploadEntry(id);
      await vi.waitFor(() => expect(finishFirst).toBeDefined());
      container.dispose();
      finishFirst?.();
      await pending;

      expect(second).not.toHaveBeenCalled();
      expect(mockUploadFile).not.toHaveBeenCalled();
    });

    it('does not warn about a hook that rejects because the upload was cancelled', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      let started = false;
      const { controller, collection } = setup({
        hooks: [
          makeHook({
            handler: ({ signal }) => {
              started = true;
              return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
            },
          }),
        ],
      });
      const id = collection.add({ file: new File(['x'], 'a.txt') });

      const pending = controller.uploadEntry(id);
      await vi.waitFor(() => expect(started).toBe(true));
      collection.read(id)?.get('abortController')?.abort();
      await pending;

      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    // The success write-back overwrites fileName/mimeType with the server's
    // values, so the hook's re-derivation is verified by capturing the entry
    // state at upload time (after the hook ran, before the result lands).
    it('applies a File-returning hook and re-derives mimeType/isImage/fileSize/fileName', async () => {
      const newFile = new File(['bigger-content'], 'transformed.png', { type: 'image/png' });
      const { controller, collection } = setup({ hooks: [makeHook({ handler: () => ({ file: newFile }) })] });
      const id = collection.add({ file: new File(['x'], 'a.txt'), fileName: 'a.txt' });

      let atUpload: Partial<UploadEntryData> = {};
      mockUploadFile.mockImplementation(async () => {
        const e = collection.read(id);
        atUpload = {
          mimeType: e?.get('mimeType'),
          isImage: e?.get('isImage'),
          fileName: e?.get('fileName'),
          fileSize: e?.get('fileSize'),
        };
        return makeFileInfo();
      });

      await controller.uploadEntry(id);

      expect(atUpload.mimeType).toBe('image/png');
      expect(atUpload.isImage).toBe(true);
      expect(atUpload.fileName).toBe('transformed.png');
      expect(atUpload.fileSize).toBe(newFile.size);
      expect(mockUploadFile).toHaveBeenCalledWith(newFile, expect.any(Object));
    });

    it('applies a Blob-returning hook without touching fileName', async () => {
      const newBlob = new Blob(['data'], { type: 'text/plain' });
      const { controller, collection } = setup({ hooks: [makeHook({ handler: () => ({ file: newBlob }) })] });
      const id = collection.add({ file: new File(['x'], 'a.txt'), fileName: 'a.txt' });

      let fileNameAtUpload: string | null | undefined;
      mockUploadFile.mockImplementation(async () => {
        fileNameAtUpload = collection.read(id)?.get('fileName');
        return makeFileInfo();
      });

      await controller.uploadEntry(id);

      expect(fileNameAtUpload).toBe('a.txt'); // unchanged — a Blob has no name
      expect(mockUploadFile).toHaveBeenCalledWith(newBlob, expect.any(Object));
    });

    it('does nothing when the hook returns the same file reference', async () => {
      const { controller, collection } = setup({ hooks: [makeHook({ handler: ({ file }) => ({ file }) })] });
      const original = new File(['x'], 'a.txt');
      const id = collection.add({ file: original });

      await controller.uploadEntry(id);

      expect(mockUploadFile).toHaveBeenCalledWith(original, expect.any(Object));
    });

    it('isolates a throwing hook and still uploads', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { controller, collection } = setup({
        hooks: [
          makeHook({
            handler: () => {
              throw new Error('hook boom');
            },
          }),
        ],
      });
      const id = collection.add({ file: new File(['x'], 'a.txt') });

      await controller.uploadEntry(id);

      expect(warn).toHaveBeenCalledWith('[uc][upload]', expect.stringContaining('beforeUpload'), expect.any(Error));
      expect(mockUploadFile).toHaveBeenCalledTimes(1);
    });

    it('aborts the signal of a hook that times out, and leaves no timer behind', async () => {
      vi.useFakeTimers();
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      let received: AbortSignal | undefined;
      const { controller, collection } = setup({
        hooks: [
          makeHook({
            timeout: 50,
            handler: ({ signal }) => {
              received = signal;
              return new Promise<never>(() => {});
            },
          }),
          makeHook({ pluginId: 'p2' }),
        ],
      });
      const id = collection.add({ file: new File(['x'], 'a.txt') });

      const promise = controller.uploadEntry(id);
      await vi.advanceTimersByTimeAsync(60);
      await promise;

      expect(received?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('skips a hook that exceeds its timeout and still uploads', async () => {
      vi.useFakeTimers();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { controller, collection } = setup({
        hooks: [makeHook({ timeout: 50, handler: () => new Promise<never>(() => {}) })],
      });
      const id = collection.add({ file: new File(['x'], 'a.txt') });

      const promise = controller.uploadEntry(id);
      await vi.advanceTimersByTimeAsync(60);
      await promise;

      expect(warn).toHaveBeenCalledWith('[uc][upload]', expect.stringContaining('beforeUpload'), expect.any(Error));
      expect(mockUploadFile).toHaveBeenCalledTimes(1);
    });

    it('nulls mimeType for a typeless transformed file and keeps preset cdnUrlModifiers', async () => {
      const typeless = new Blob(['x']); // .type === ''
      const { controller, collection } = setup({ hooks: [makeHook({ handler: () => ({ file: typeless }) })] });
      const id = collection.add({ file: new File(['a'], 'a.txt'), cdnUrlModifiers: '-/preview/' });

      let mimeAtUpload: string | null | undefined;
      mockUploadFile.mockImplementation(async () => {
        mimeAtUpload = collection.read(id)?.get('mimeType');
        return makeFileInfo();
      });

      await controller.uploadEntry(id);

      expect(mimeAtUpload).toBeNull(); // file.type '' || null
      expect(collection.read(id)?.get('cdnUrlModifiers')).toBe('-/preview/'); // preset kept over ?? ''
    });

    it('does not run hooks for a non-File input (externalUrl)', async () => {
      const handler = vi.fn(({ file }: { file: File | Blob }) => ({ file }));
      const { controller, collection } = setup({ hooks: [makeHook({ handler })] });
      const id = collection.add({ externalUrl: 'https://example.com/x.png' });

      await controller.uploadEntry(id);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('errors', () => {
    it('throws "No file input" path → writes a generic uploadError and reports telemetry', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { controller, collection, onUploadError } = setup();
      const id = collection.add({ fileName: 'empty' }); // no file/externalUrl/uuid

      await controller.uploadEntry(id);

      const entry = collection.read(id);
      expect(entry?.get('isUploading')).toBe(false);
      expect(entry?.get('uploadError')?.message).toBe('Something went wrong');
      expect(error).toHaveBeenCalledWith('[uc][upload]', 'Unknown upload error', expect.any(Error));
      expect(onUploadError).toHaveBeenCalledWith(expect.any(Error), expect.stringContaining('file upload'));
    });

    it('handles a CancelError without setting uploadError or reporting telemetry', async () => {
      const cancel = new CancelError('cancelled');
      cancel.isCancel = true;
      mockUploadFile.mockRejectedValue(cancel);
      const { controller, collection, onUploadError } = setup();
      const id = collection.add({ file: new File(['x'], 'a.txt') });

      await controller.uploadEntry(id);

      const entry = collection.read(id);
      expect(entry?.get('isUploading')).toBe(false);
      expect(entry?.get('uploadProgress')).toBe(0);
      expect(entry?.get('uploadError')).toBeNull();
      expect(onUploadError).not.toHaveBeenCalled();
    });

    it('stores an UploadcareError and reports telemetry', async () => {
      const ucError = new UploadcareError('bad upload');
      mockUploadFile.mockRejectedValue(ucError);
      const { controller, collection, onUploadError } = setup();
      const id = collection.add({ file: new File(['x'], 'a.txt') });

      await controller.uploadEntry(id);

      const entry = collection.read(id);
      expect(entry?.get('uploadError')).toBe(ucError);
      expect(onUploadError).toHaveBeenCalled();
    });

    it('does not throw while reporting an upload error to telemetry', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockUploadFile.mockRejectedValue(new UploadcareError('bad'));
      // The telemetry error sink (`TelemetryManager.sendEventError`) is always
      // present and never throws, so the error-report path resolves cleanly.
      const { controller, collection } = setup();
      const id = collection.add({ file: new File(['x'], 'a.txt') });

      await expect(controller.uploadEntry(id)).resolves.toBeUndefined();
    });
  });

  describe('abort', () => {
    it('aborts the in-flight controller stored on the entry', () => {
      const { controller, collection } = setup();
      const id = collection.add({ file: new File(['x'], 'a.txt') });
      const ac = new AbortController();
      const spy = vi.spyOn(ac, 'abort');
      collection.read(id)?.set('abortController', ac);

      controller.abort(id);

      expect(spy).toHaveBeenCalled();
    });

    it('is a no-op for a missing entry or an entry without a controller', () => {
      const { controller, collection } = setup();
      const id = collection.add({ file: new File(['x'], 'a.txt') });

      expect(() => controller.abort('missing' as Uid)).not.toThrow();
      expect(() => controller.abort(id)).not.toThrow();
    });
  });

  describe('queue concurrency', () => {
    it('initializes concurrency from maxConcurrentRequests', () => {
      const { controller } = setup({ cfg: { maxConcurrentRequests: 4 } });
      expect(queueConcurrency(controller)).toBe(4);
    });

    it('falls back to 1 for a non-positive/invalid value', () => {
      const { controller } = setup({ cfg: { maxConcurrentRequests: 0 } });
      expect(queueConcurrency(controller)).toBe(1);
    });

    it('clamps a negative value to 1', () => {
      const { controller } = setup({ cfg: { maxConcurrentRequests: -3 } });
      expect(queueConcurrency(controller)).toBe(1);
    });

    it('falls back to 1 for a non-finite value', () => {
      const { controller } = setup({ cfg: { maxConcurrentRequests: Number.NaN } });
      expect(queueConcurrency(controller)).toBe(1);
    });

    it('floors a fractional value', () => {
      const { controller } = setup({ cfg: { maxConcurrentRequests: 3.9 } });
      expect(queueConcurrency(controller)).toBe(3);
    });

    it('syncs concurrency when the config changes', () => {
      const { controller, config } = setup({ cfg: { maxConcurrentRequests: 2 } });
      config.set('maxConcurrentRequests', 7);
      expect(queueConcurrency(controller)).toBe(7);
    });

    it('stops syncing after destroy()', () => {
      const { controller, config } = setup({ cfg: { maxConcurrentRequests: 2 } });
      controller.destroy();
      config.set('maxConcurrentRequests', 9);
      expect(queueConcurrency(controller)).toBe(2);
    });
  });

  describe('debug', () => {
    it('emits an "upload options" debug line through the per-ctx gated logger', async () => {
      // Debug output is gated per-ctx by the `debug` config — enable it so the
      // gated tier fires; the multi-chip badge header is logged via console.log.
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { controller, collection } = setup({ cfg: { debug: true } });
      const id = collection.add({ file: new File(['x'], 'a.txt') });
      await expect(controller.uploadEntry(id)).resolves.toBeUndefined();
      expect(logSpy).toHaveBeenCalledWith(
        '%c uc %c upload %c',
        expect.any(String),
        expect.any(String),
        '',
        'upload options',
        expect.any(Object),
      );
    });

    it('redacts secureSignature from the "upload options" debug log', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { controller, collection } = setup({
        cfg: {
          debug: true,
          secureSignature: 'SECRET-SIG',
          secureExpire: String(Math.floor(Date.now() / 1000) + 100000),
        },
      });
      const id = collection.add({ file: new File(['x'], 'a.txt') });
      await expect(controller.uploadEntry(id)).resolves.toBeUndefined();

      const optionsCall = logSpy.mock.calls.find((c) => c.includes('upload options'));
      expect(optionsCall).toBeDefined();
      expect((optionsCall?.at(-1) as { secureSignature?: string }).secureSignature).toBe('[redacted]');
      // The real credential must never reach the console.
      expect(JSON.stringify(logSpy.mock.calls)).not.toContain('SECRET-SIG');
    });

    it('stays silent when this ctx has debug off', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});
      const { controller, collection } = setup();
      const id = collection.add({ file: new File(['x'], 'a.txt') });
      await expect(controller.uploadEntry(id)).resolves.toBeUndefined();
      expect(logSpy).not.toHaveBeenCalled();
      expect(tableSpy).not.toHaveBeenCalled();
    });
  });

  describe('buildUploadOptions', () => {
    it('maps config keys to upload-client options', async () => {
      const { controller } = setup({
        cfg: { pubkey: 'demopublickey', baseUrl: 'https://up.example', checkForUrlDuplicates: true },
      });

      const opts = await controller.buildUploadOptions();

      expect(opts).toMatchObject({
        publicKey: 'demopublickey',
        baseURL: 'https://up.example',
        checkForUrlDuplicates: true,
      });
    });

    it('injects the secure token from the SecureUploadsController', async () => {
      const { controller } = setup({ cfg: { secureSignature: 'sig', secureExpire: '4102444800' } });

      const opts = await controller.buildUploadOptions();

      expect(opts).toMatchObject({ secureSignature: 'sig', secureExpire: '4102444800' });
    });

    it('falls back to no secure token when getSecureToken rejects', async () => {
      const container = new ControllerContainer();
      const secureUploads = {
        getSecureToken: () => Promise.reject(new Error('boom')),
      } as unknown as SecureUploadsController;
      // Bind a fake secure-uploads whose token resolution rejects.
      container.bind(SecureUploadsController, () => secureUploads);
      const controller = container.get(UploadController);

      const opts = await controller.buildUploadOptions();

      expect(opts.secureSignature).toBeUndefined();
      expect(opts.secureExpire).toBeUndefined();
    });
  });

  describe('getMetadataFor', () => {
    it('returns a static metadata config value', async () => {
      const { controller } = setup({ cfg: { metadata: { a: '1' } } });

      await expect(controller.getMetadataFor('x' as Uid)).resolves.toEqual({ a: '1' });
    });

    it('invokes a metadata callback with the entry as an output item', async () => {
      const callback = vi.fn(() => ({ b: '2' }));
      const { controller, collection } = setup({ cfg: { metadata: callback } });
      const uid = collection.add({ fileName: 'a.txt' });

      const result = await controller.getMetadataFor(uid);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ internalId: uid, name: 'a.txt' }));
      expect(result).toEqual({ b: '2' });
    });

    it('returns undefined when metadata is not configured', async () => {
      const { controller } = setup();

      await expect(controller.getMetadataFor('x' as Uid)).resolves.toBeUndefined();
    });
  });

  describe('ctx teardown', () => {
    const disposeCtx = (controller: UploadController): void => {
      containerOf(controller)?.dispose();
    };

    it('does not start an entry deferred by uploadEntries once the ctx is torn down', async () => {
      vi.useFakeTimers();
      const { controller, collection } = setup();
      const id = collection.add({ file: new File(['a'], 'a.txt') });

      controller.uploadEntries([id]);
      disposeCtx(controller);
      await vi.runAllTimersAsync();

      expect(mockUploadFile).not.toHaveBeenCalled();
      // Reading `_collection` on the disposed container would have built an orphan collection on it.
      expect(containerOf(controller)?.has(UploadCollectionController)).toBe(false);
    });

    it('does not start the upload when the ctx is torn down while upload options resolve', async () => {
      let resolveSignature!: (value: { secureSignature: string; secureExpire: string }) => void;
      const { controller, collection } = setup({
        cfg: {
          secureUploadsSignatureResolver: () =>
            new Promise((resolve) => {
              resolveSignature = resolve;
            }),
        },
      });
      const id = collection.add({ file: new File(['a'], 'a.txt') });

      const pending = controller.uploadEntry(id);
      await vi.waitFor(() => expect(resolveSignature).toBeDefined());
      disposeCtx(controller);
      resolveSignature({ secureSignature: 'sig', secureExpire: String(Date.now() / 1000 + 3600) });
      await pending;

      expect(mockUploadFile).not.toHaveBeenCalled();
    });

    it('drops a failure that settles after the ctx is torn down instead of reporting it', async () => {
      let rejectUpload!: (error: Error) => void;
      mockUploadFile.mockReturnValue(
        new Promise((_, reject) => {
          rejectUpload = reject;
        }),
      );
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { controller, collection, onUploadError } = setup();
      const id = collection.add({ file: new File(['a'], 'a.txt') });

      const pending = controller.uploadEntry(id);
      await vi.waitFor(() => expect(mockUploadFile).toHaveBeenCalled());
      disposeCtx(controller);
      rejectUpload(new Error('late'));
      await pending;

      expect(onUploadError).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });

    it('ignores uploadEntry once the ctx is torn down', async () => {
      const { controller, collection } = setup();
      const id = collection.add({ file: new File(['a'], 'a.txt') });

      disposeCtx(controller);
      await controller.uploadEntry(id);

      expect(mockUploadFile).not.toHaveBeenCalled();
      expect(containerOf(controller)?.has(UploadCollectionController)).toBe(false);
    });
  });
});
