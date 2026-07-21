import { CancelError, UploadcareError, type UploadcareFile, uploadFile } from '@uploadcare/upload-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Uid } from '../../lit/Uid';
import type { ConfigType, OutputFileEntry } from '../../types';
import { ControllerContainer } from '../di/ControllerContainer';
import { __resetLoggerForTests } from '../logger';
import type { Owned, PluginFileHookRegistration } from '../managers/plugin/PluginTypes';
import type { UploadEntryData } from '../uploadEntrySchema';
import { ConfigController } from './ConfigController';
import { SecureUploadsController } from './SecureUploadsController';
import { UploadCollectionController } from './UploadCollectionController';
import { UploadController } from './UploadController';
import { UploadHostBridge } from './UploadHostBridge';

// A full `UploadHostBridge` with inert defaults; only the members a test cares
// about are overridden. Inlined (not shared) so it stays out of coverage.
const makeUploadHost = (overrides: Partial<UploadHostBridge> = {}): UploadHostBridge =>
  ({
    getFileHooks: () => [],
    getOutputItem: ((uid: string) => ({ internalId: uid })) as unknown as UploadHostBridge['getOutputItem'],
    getApi: (() => ({})) as unknown as UploadHostBridge['getApi'],
    emitCommonUploadFailed: () => {},
    emit: () => {},
    getOutputCollectionState: (() => ({})) as unknown as UploadHostBridge['getOutputCollectionState'],
    getOutputData: () => [],
    runOnAddHooks: () => {},
    onResolverError: () => {},
    onUploadError: () => {},
    onValidatorError: () => {},
    ...overrides,
  }) satisfies UploadHostBridge;

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
const makeOutputItem = (uid: Uid): OutputFileEntry => ({ internalId: uid }) as unknown as OutputFileEntry;

type SetupOpts = {
  cfg?: Partial<ConfigType>;
  hooks?: readonly FileHook[];
  withOnError?: boolean;
};

const setup = (opts: SetupOpts = {}) => {
  const container = new ControllerContainer();
  const config = container.get(ConfigController);
  applyConfig(config, opts.cfg ?? {});
  const collection = container.get(UploadCollectionController);
  const getFileHooks = vi.fn<() => readonly FileHook[]>(() => opts.hooks ?? []);
  const getOutputItem = vi.fn<(uid: Uid) => OutputFileEntry>((uid) => makeOutputItem(uid));
  const onUploadError = vi.fn<(error: unknown, context: string) => void>();
  container.bind(UploadHostBridge, () =>
    makeUploadHost({
      getFileHooks,
      getOutputItem: getOutputItem as unknown as UploadHostBridge['getOutputItem'],
      // `withOnError: false` → an inert no-op sink, mirroring v1's "no sink
      // provided" path.
      onUploadError: opts.withOnError === false ? () => {} : onUploadError,
    }),
  );
  const secureUploads = container.get(SecureUploadsController);
  const controller = container.get(UploadController);
  return { controller, config, collection, secureUploads, getFileHooks, getOutputItem, onUploadError };
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

  describe('happy path', () => {
    it('uploads a File and writes the success state back to the entry', async () => {
      mockUploadFile.mockResolvedValue(
        makeFileInfo({ uuid: 'u1', originalFilename: 'srv.png', size: 10, cdnUrl: 'https://cdn/u1/' }),
      );
      const { controller, collection } = setup();
      const id = collection.add({ file: new File(['x'], 'a.txt'), fileName: 'a.txt', source: 'local' });

      await controller.uploadEntry(id);

      const entry = collection.read(id);
      expect(entry?.getValue('fileInfo')).toMatchObject({ uuid: 'u1' });
      expect(entry?.getValue('isUploading')).toBe(false);
      expect(entry?.getValue('isQueuedForUploading')).toBe(false);
      expect(entry?.getValue('uuid')).toBe('u1');
      expect(entry?.getValue('uploadProgress')).toBe(100);
      expect(entry?.getValue('cdnUrl')).toBe('https://cdn/u1/');
    });

    it('prefers an existing entry cdnUrl over the server one', async () => {
      mockUploadFile.mockResolvedValue(makeFileInfo({ cdnUrl: 'https://cdn/server/' }));
      const { controller, collection } = setup();
      const id = collection.add({ file: new File(['x'], 'a.txt'), cdnUrl: 'https://cdn/preset/' });

      await controller.uploadEntry(id);

      expect(collection.read(id)?.getValue('cdnUrl')).toBe('https://cdn/preset/');
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
      expect(entry?.getValue('mimeType')).toBe('image/webp');
      expect(entry?.getValue('isImage')).toBe(false);
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

      // The batch is populated synchronously; the uploads are deferred a macrotask.
      expect([...controller.uploadBatch].sort()).toEqual([a, b].sort());
      await vi.runAllTimersAsync();
      expect(mockUploadFile).toHaveBeenCalledTimes(2);
    });

    it('excludes removed entries from the active batch', () => {
      // Fake timers so the deferred `uploadEntry` calls don't leak into later tests.
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
      entry?.observe('uploadProgress', (v) => v !== undefined && seen.push(v), { immediate: true });

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
      collection.read(id)?.observe('uploadProgress', (v) => v !== undefined && seen.push(v), { immediate: true });

      await controller.uploadEntry(id);

      // Only the final success write (100); no mid-flight value from the event.
      expect(seen.filter((v) => v !== 0 && v !== 100)).toHaveLength(0);
    });
  });

  describe('beforeUpload hooks', () => {
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
          mimeType: e?.getValue('mimeType'),
          isImage: e?.getValue('isImage'),
          fileName: e?.getValue('fileName'),
          fileSize: e?.getValue('fileSize'),
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
        fileNameAtUpload = collection.read(id)?.getValue('fileName');
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
        mimeAtUpload = collection.read(id)?.getValue('mimeType');
        return makeFileInfo();
      });

      await controller.uploadEntry(id);

      expect(mimeAtUpload).toBeNull(); // file.type '' || null
      expect(collection.read(id)?.getValue('cdnUrlModifiers')).toBe('-/preview/'); // preset kept over ?? ''
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
      expect(entry?.getValue('isUploading')).toBe(false);
      expect(entry?.getValue('uploadError')?.message).toBe('Something went wrong');
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
      expect(entry?.getValue('isUploading')).toBe(false);
      expect(entry?.getValue('uploadProgress')).toBe(0);
      expect(entry?.getValue('uploadError')).toBeNull();
      expect(onUploadError).not.toHaveBeenCalled();
    });

    it('stores an UploadcareError and reports telemetry', async () => {
      const ucError = new UploadcareError('bad upload');
      mockUploadFile.mockRejectedValue(ucError);
      const { controller, collection, onUploadError } = setup();
      const id = collection.add({ file: new File(['x'], 'a.txt') });

      await controller.uploadEntry(id);

      const entry = collection.read(id);
      expect(entry?.getValue('uploadError')).toBe(ucError);
      expect(onUploadError).toHaveBeenCalled();
    });

    it('does not throw when no onUploadError sink is provided', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockUploadFile.mockRejectedValue(new UploadcareError('bad'));
      const { controller, collection } = setup({ withOnError: false });
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
      collection.read(id)?.setValue('abortController', ac);

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
      container.bind(UploadHostBridge, () => makeUploadHost());
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

    it('invokes a metadata callback with the resolved output item', async () => {
      const callback = vi.fn(() => ({ b: '2' }));
      const { controller, getOutputItem } = setup({ cfg: { metadata: callback } });

      const result = await controller.getMetadataFor('uid-7' as Uid);

      expect(getOutputItem).toHaveBeenCalledWith('uid-7');
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ internalId: 'uid-7' }));
      expect(result).toEqual({ b: '2' });
    });

    it('returns undefined when metadata is not configured', async () => {
      const { controller } = setup();

      await expect(controller.getMetadataFor('x' as Uid)).resolves.toBeUndefined();
    });
  });
});
