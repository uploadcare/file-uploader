import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter, EventType } from '../blocks/UploadCtxProvider/EventEmitter';
import { ACTIVITY_TYPES } from '../lit/activity-constants';
import { ensureUploaderCtx } from '../lit/ensureUploaderCtx';
import { ensureUploaderScope } from '../lit/ensureUploaderScope';
import { createL10n } from '../lit/l10n';
import { PubSub } from '../lit/PubSubCompat';
import type { SharedState } from '../lit/SharedState';
import { createSharedInstancesBag, type SharedInstancesBag } from '../lit/shared-instances';
import type { UploadcareFile } from '../types/index';
import { BASIC_IMAGE_WILDCARD, BASIC_VIDEO_WILDCARD } from '../utils/fileTypes';
import { UploadSource } from '../utils/UploadSource';
import { ConfigController } from './controllers/ConfigController';
import { LocaleController } from './controllers/LocaleController';
import { RouterController } from './controllers/RouterController';
import { UploadCollectionController } from './controllers/UploadCollectionController';
import { ControllerContainer } from './di/ControllerContainer';
import { PluginController } from './managers/plugin';
import type { UploaderPublicApi } from './UploaderPublicApi';
import { UploaderPublicApi as UploaderPublicApiClass } from './UploaderPublicApi';

/**
 * Behavior-preservation coverage for `UploaderPublicApi`, written BEFORE the
 * M-god step 8a rewrite (off the `bag`/`SharedInstance` proxy onto container
 * `@inject`). The harness builds the api through the REAL production seam
 * (`ensureUploaderCtx` + `ensureUploaderScope` → `bag.api`), so the setup is
 * identical before and after the rewrite — the exact same behavioral assertions
 * must pass on both implementations, which is the proof the public surface is
 * unchanged.
 */

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  // Drain one macrotask too, so the `_pluginsReady().then(…).then(waitForActivityBlock).then(…)`
  // chains behind `navigate`/`setModalState` fully settle.
  await new Promise((resolve) => setTimeout(resolve, 0));
};

// M-god step 8e dissolved the `UploaderController` facade; the harness exposes
// the same `locale`/`collection`/`router` handles the tests read, resolved
// straight off the ctx's `ControllerContainer` (stable per-ctx identity), so
// every behavioral assertion below is unchanged.
type Ctrl = {
  readonly locale: LocaleController;
  readonly collection: UploadCollectionController;
  readonly router: RouterController;
  readonly config: ConfigController;
  readonly eventEmitter: EventEmitter;
  readonly container: ControllerContainer;
};

type Harness = {
  ctxName: string;
  ctx: PubSub<SharedState>;
  bag: SharedInstancesBag;
  ctrl: Ctrl;
  api: UploaderPublicApi;
};

let seq = 0;
const created: string[] = [];

const setup = (): Harness => {
  const ctxName = `uploader-public-api-test-${seq++}`;
  const ctx = ensureUploaderCtx(ctxName);
  created.push(ctxName);
  const bag = createSharedInstancesBag(() => PubSub.getCtx<SharedState>(ctxName)!);
  const container = ctx.container();
  const eventEmitter = container.get(EventEmitter);
  ensureUploaderScope(ctx, container, undefined, (type, payload, options) => eventEmitter.emit(type, payload, options));
  const ctrl: Ctrl = {
    get locale() {
      return container.get(LocaleController);
    },
    get collection() {
      return container.get(UploadCollectionController);
    },
    get router() {
      return container.get(RouterController);
    },
    get config() {
      return container.get(ConfigController);
    },
    eventEmitter,
    container,
  };
  const api = bag.api;
  return { ctxName, ctx, bag, ctrl, api };
};

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  while (created.length) {
    const name = created.pop()!;
    if (PubSub.hasCtx(name)) {
      PubSub.deleteCtx(name);
    }
  }
});

describe('UploaderPublicApi', () => {
  describe('cfg / l10n reads', () => {
    it('exposes a read-only cfg proxy backed by the ConfigController', () => {
      const { api, ctrl } = setup();
      expect(api.cfg.cdnCname).toBe('https://ucarecdn.com');
      ctrl.config.set('cdnCname', 'https://cdn.example.com');
      expect(api.cfg.cdnCname).toBe('https://cdn.example.com');
    });

    it('exposes an l10n function reading the LocaleController dictionary', () => {
      const { api, ctrl } = setup();
      ctrl.locale.set('greeting', 'Hello {{name}}');
      expect(api.l10n('greeting', { name: 'Ada' })).toBe('Hello Ada');
      // Unknown key falls back to the key itself.
      expect(api.l10n('unknown-key')).toBe('unknown-key');
    });

    it('l10n reads the same LocaleController a fresh createL10n would', () => {
      const { api, ctrl } = setup();
      const reference = createL10n(() => ctrl.locale);
      ctrl.locale.set('k', 'v');
      expect(api.l10n('k')).toBe(reference('k'));
    });
  });

  describe('addFile*', () => {
    it('addFileFromUrl adds an idle entry with API source by default', () => {
      const { api, ctrl } = setup();
      const entry = api.addFileFromUrl('https://example.com/a.jpg');
      expect(entry.status).toBe('idle');
      expect(entry.externalUrl).toBe('https://example.com/a.jpg');
      expect(entry.source).toBe(UploadSource.API);
      expect(ctrl.collection.size).toBe(1);
    });

    it('addFileFromUrl honors silent/fileName/source options', () => {
      const { api } = setup();
      const entry = api.addFileFromUrl('https://example.com/a.jpg', {
        silent: true,
        fileName: 'custom.jpg',
        source: 'my-source',
      });
      expect(entry.name).toBe('custom.jpg');
      expect(entry.source).toBe('my-source');
    });

    it('addFileFromUuid adds an idle entry carrying the uuid', () => {
      const { api } = setup();
      const entry = api.addFileFromUuid('12345678-1234-1234-1234-123456789012');
      expect(entry.uuid).toBe('12345678-1234-1234-1234-123456789012');
      expect(entry.status).toBe('idle');
    });

    it('addFileFromCdnUrl parses a valid CDN url', () => {
      const { api } = setup();
      const entry = api.addFileFromCdnUrl('https://ucarecdn.com/12345678-1234-1234-1234-123456789012/');
      expect(entry.uuid).toBe('12345678-1234-1234-1234-123456789012');
      expect(entry.cdnUrl).toBe('https://ucarecdn.com/12345678-1234-1234-1234-123456789012/');
    });

    it('addFileFromCdnUrl respects an explicit fileName over the parsed one', () => {
      const { api } = setup();
      const entry = api.addFileFromCdnUrl('https://ucarecdn.com/12345678-1234-1234-1234-123456789012/name.jpg', {
        fileName: 'override.jpg',
      });
      expect(entry.name).toBe('override.jpg');
    });

    it('addFileFromCdnUrl throws on an invalid CDN url', () => {
      const { api } = setup();
      expect(() => api.addFileFromCdnUrl('https://example.com/not-a-cdn-url')).toThrow('Invalid CDN URL');
    });

    it('addFileFromObject adds a file, deriving name/size/mime', () => {
      const { api } = setup();
      const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
      const entry = api.addFileFromObject(file);
      expect(entry.name).toBe('hello.txt');
      expect(entry.size).toBe(file.size);
      expect(entry.mimeType).toBe('text/plain');
      expect(entry.source).toBe(UploadSource.API);
    });

    it('addFileFromObject falls back to a null mimeType when the file has no type', () => {
      const { api } = setup();
      const file = new File(['x'], 'x.bin');
      const entry = api.addFileFromObject(file);
      expect(entry.mimeType).toBeNull();
    });

    it('addFileFromUploadcareFile falls back to file.mimeType and isImage default', () => {
      const { api } = setup();
      const file = {
        uuid: 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee',
        cdnUrl: 'https://ucarecdn.com/bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee/',
        originalFilename: 'doc.pdf',
        size: 7,
        mimeType: 'application/pdf',
        // no contentInfo, no isImage
      } as unknown as UploadcareFile;
      const entry = api.addFileFromUploadcareFile(file);
      expect(entry.mimeType).toBe('application/pdf');
      expect(entry.isImage).toBe(false);
    });

    it('addFileFromObject carries fullPath and custom source', () => {
      const { api } = setup();
      const file = new File(['x'], 'x.txt', { type: 'text/plain' });
      const entry = api.addFileFromObject(file, { fullPath: '/a/x.txt', source: UploadSource.LOCAL });
      expect(entry.fullPath).toBe('/a/x.txt');
      expect(entry.source).toBe(UploadSource.LOCAL);
    });

    it('addFileFromUploadcareFile adds a success entry', () => {
      const { api } = setup();
      const file = {
        uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        cdnUrl: 'https://ucarecdn.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/',
        originalFilename: 'pic.png',
        size: 123,
        isImage: true,
        mimeType: 'image/png',
        contentInfo: { mime: { mime: 'image/png' } },
      } as unknown as UploadcareFile;
      const entry = api.addFileFromUploadcareFile(file);
      expect(entry.status).toBe('success');
      expect(entry.uuid).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
      expect(entry.name).toBe('pic.png');
      expect(entry.isSuccess).toBe(true);
    });
  });

  describe('removeFileByInternalId / removeAllFiles', () => {
    it('removes an existing file by internal id', () => {
      const { api, ctrl } = setup();
      const entry = api.addFileFromUrl('https://example.com/a.jpg');
      expect(ctrl.collection.size).toBe(1);
      api.removeFileByInternalId(entry.internalId);
      expect(ctrl.collection.size).toBe(0);
    });

    it('throws when removing an unknown internal id', () => {
      const { api } = setup();
      expect(() => api.removeFileByInternalId('does-not-exist')).toThrow(/not found/);
    });

    it('removeAllFiles clears the collection', () => {
      const { api, ctrl } = setup();
      api.addFileFromUrl('https://example.com/a.jpg');
      api.addFileFromUrl('https://example.com/b.jpg');
      expect(ctrl.collection.size).toBe(2);
      api.removeAllFiles();
      expect(ctrl.collection.size).toBe(0);
    });
  });

  describe('uploadAll', () => {
    it('replaces the uploadTrigger Set and emits COMMON_UPLOAD_START for uploadable entries', () => {
      const { api, ctx } = setup();
      const before = ctx.read('*uploadTrigger');
      const triggerValues: Array<Set<unknown>> = [];
      const unsub = ctx.sub('*uploadTrigger', (v) => triggerValues.push(v as Set<unknown>), false);
      const startHandler = vi.fn();
      api.on(EventType.COMMON_UPLOAD_START, startHandler);

      const e1 = api.addFileFromUrl('https://example.com/a.jpg');
      const e2 = api.addFileFromUrl('https://example.com/b.jpg');

      api.uploadAll();

      // REPLACE-semantics: a NEW Set instance (not the seeded one, not mutated).
      const after = ctx.read('*uploadTrigger') as Set<string>;
      expect(after).not.toBe(before);
      expect([...after].sort()).toEqual([e1.internalId, e2.internalId].sort());
      // The replace fired the subscriber exactly once with the new Set.
      expect(triggerValues).toHaveLength(1);
      expect(triggerValues[0]).toBe(after);
      expect(startHandler).toHaveBeenCalledTimes(1);
      unsub();
    });

    it('is a no-op (no emit, no trigger change) when nothing is uploadable', () => {
      const { api, ctx } = setup();
      const before = ctx.read('*uploadTrigger');
      const startHandler = vi.fn();
      api.on(EventType.COMMON_UPLOAD_START, startHandler);

      api.uploadAll();

      expect(ctx.read('*uploadTrigger')).toBe(before);
      expect(startHandler).not.toHaveBeenCalled();
    });

    it('skips entries already uploaded (fileInfo present)', () => {
      const { api, ctx } = setup();
      const startHandler = vi.fn();
      api.on(EventType.COMMON_UPLOAD_START, startHandler);
      // A file added from an UploadcareFile has fileInfo → not uploadable.
      api.addFileFromUploadcareFile({
        uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        cdnUrl: 'https://ucarecdn.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/',
        originalFilename: 'pic.png',
        size: 1,
        isImage: false,
        mimeType: 'image/png',
      } as unknown as UploadcareFile);

      api.uploadAll();

      expect(startHandler).not.toHaveBeenCalled();
      expect(ctx.read('*uploadTrigger')).toBeInstanceOf(Set);
      expect((ctx.read('*uploadTrigger') as Set<string>).size).toBe(0);
    });
  });

  describe('getOutputItem', () => {
    it('throws for an unknown entry id', () => {
      const { api } = setup();
      expect(() => api.getOutputItem('nope')).toThrow(/not found/);
    });

    it('reports idle status for a freshly added external url', () => {
      const { api } = setup();
      const entry = api.addFileFromUrl('https://example.com/a.jpg');
      const item = api.getOutputItem(entry.internalId);
      expect(item.status).toBe('idle');
      expect(item.isSuccess).toBe(false);
      expect(item.isUploading).toBe(false);
      expect(item.isFailed).toBe(false);
      expect(item.isRemoved).toBe(false);
    });

    it('reports failed status when the entry has errors', () => {
      const { api, ctrl } = setup();
      const entry = api.addFileFromUrl('https://example.com/a.jpg');
      ctrl.collection.publishProp(entry.internalId as never, 'errors', [{ type: 'someError' }] as never);
      const item = api.getOutputItem(entry.internalId);
      expect(item.status).toBe('failed');
      expect(item.isFailed).toBe(true);
    });

    it('reports uploading status when isUploading is set', () => {
      const { api, ctrl } = setup();
      const entry = api.addFileFromUrl('https://example.com/a.jpg');
      ctrl.collection.publishProp(entry.internalId as never, 'isUploading', true as never);
      const item = api.getOutputItem(entry.internalId);
      expect(item.status).toBe('uploading');
      expect(item.isUploading).toBe(true);
    });

    it('reports removed status when isRemoved is set', () => {
      const { api, ctrl } = setup();
      const entry = api.addFileFromUrl('https://example.com/a.jpg');
      ctrl.collection.publishProp(entry.internalId as never, 'isRemoved', true as never);
      const item = api.getOutputItem(entry.internalId);
      expect(item.status).toBe('removed');
      expect(item.isRemoved).toBe(true);
    });

    it('reports success status and surfaces fileInfo fields', () => {
      const { api } = setup();
      const entry = api.addFileFromUploadcareFile({
        uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        cdnUrl: 'https://ucarecdn.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/',
        originalFilename: 'pic.png',
        size: 42,
        isImage: true,
        mimeType: 'image/png',
      } as unknown as UploadcareFile);
      const item = api.getOutputItem(entry.internalId);
      expect(item.status).toBe('success');
      expect(item.name).toBe('pic.png');
      expect(item.size).toBe(42);
      expect(item.isImage).toBe(true);
    });
  });

  describe('getOutputCollectionState', () => {
    it('returns an idle state for an empty collection', () => {
      const { api } = setup();
      const state = api.getOutputCollectionState();
      expect(state.status).toBe('idle');
      expect(state.totalCount).toBe(0);
      expect(state.allEntries).toHaveLength(0);
      expect(state.progress).toBe(0);
    });

    it('reflects added entries', () => {
      const { api } = setup();
      api.addFileFromUrl('https://example.com/a.jpg');
      const state = api.getOutputCollectionState();
      expect(state.totalCount).toBe(1);
      expect(state.allEntries).toHaveLength(1);
      expect(state.idleEntries).toHaveLength(1);
    });
  });

  describe('flow navigation', () => {
    it('initFlow navigates to the upload list when the collection is non-empty', () => {
      const { api, ctrl } = setup();
      const navigate = vi.spyOn(ctrl.router, 'navigate');
      api.addFileFromUrl('https://example.com/a.jpg');

      api.initFlow();

      expect(navigate).toHaveBeenCalledWith(ACTIVITY_TYPES.UPLOAD_LIST);
    });

    it('initFlow navigates to start-from when multiple sources are configured', async () => {
      const { api, ctrl } = setup();
      ctrl.config.set('sourceList', 'local, url, camera');
      const navigate = vi.spyOn(ctrl.router, 'navigate');

      api.initFlow();
      await flush();

      expect(navigate).toHaveBeenCalledWith(ACTIVITY_TYPES.START_FROM);
    });

    it('initFlow navigates to start-from when no sources are configured', async () => {
      const { api, ctrl } = setup();
      ctrl.config.set('sourceList', '');
      const navigate = vi.spyOn(ctrl.router, 'navigate');

      api.initFlow();
      await flush();

      expect(navigate).toHaveBeenCalledWith(ACTIVITY_TYPES.START_FROM);
    });

    it('initFlow selects the single registered source directly', async () => {
      const { api, ctrl, bag } = setup();
      ctrl.config.set('sourceList', 'local');
      const onSelect = vi.fn();
      bag.pluginManager.registry.addSource('p', { id: 'local', label: 'Local', onSelect });

      api.initFlow();
      await flush();

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('initFlow selects the origin source when its single expansion is unknown', async () => {
      const { api, ctrl, bag } = setup();
      ctrl.config.set('sourceList', 'local');
      const onSelect = vi.fn();
      // expand() returns a single id that is NOT itself a registered source,
      // so `find(expandedIds[0]) ?? registeredSource` falls back to the origin.
      bag.pluginManager.registry.addSource('p', {
        id: 'local',
        label: 'Local',
        onSelect,
        expand: () => ['ghost'],
      });

      api.initFlow();
      await flush();

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('initFlow navigates to start-from when a single source expands to many', async () => {
      const { api, ctrl, bag } = setup();
      ctrl.config.set('sourceList', 'group');
      const navigate = vi.spyOn(ctrl.router, 'navigate');
      bag.pluginManager.registry.addSource('p', {
        id: 'group',
        label: 'Group',
        onSelect: vi.fn(),
        expand: () => ['a', 'b'],
      });

      api.initFlow();
      await flush();

      expect(navigate).toHaveBeenCalledWith(ACTIVITY_TYPES.START_FROM);
    });

    it('initFlow re-opens the current activity when the single source is unregistered', async () => {
      const { api, ctrl } = setup();
      ctrl.config.set('sourceList', 'unregistered-source');
      ctrl.router.setActivity('start-from' as never);
      const openModal = vi.spyOn(ctrl.router, 'openModal');

      api.initFlow();
      await flush();

      expect(openModal).toHaveBeenCalledWith('start-from');
    });

    it('doneFlow resets the router and lands on the configured done activity', () => {
      const { api, ctrl } = setup();
      ctrl.router.configure({ doneActivity: 'upload-list' });
      const navigate = vi.spyOn(ctrl.router, 'navigate');

      api.doneFlow();

      expect(navigate).toHaveBeenNthCalledWith(1, null);
      expect(navigate).toHaveBeenNthCalledWith(2, 'upload-list');
    });

    it('doneFlow only resets when no done activity is configured', () => {
      const { api, ctrl } = setup();
      const navigate = vi.spyOn(ctrl.router, 'navigate');

      api.doneFlow();

      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(null);
    });
  });

  describe('navigate / setCurrentActivity / setModalState', () => {
    it('navigate routes to the requested activity after plugins are ready', async () => {
      const { api, ctrl } = setup();
      ctrl.router.activityBlockMounted('upload-list' as never);
      const navigate = vi.spyOn(ctrl.router, 'navigate');

      api.navigate('upload-list');
      await flush();

      expect(navigate).toHaveBeenCalledWith('upload-list', {});
    });

    it('navigate(null) closes without waiting for a block', async () => {
      const { api, ctrl } = setup();
      const navigate = vi.spyOn(ctrl.router, 'navigate');

      api.navigate(null);
      await flush();

      expect(navigate).toHaveBeenCalledWith(null, {});
    });

    it('navigate warns when the target activity block never mounts', async () => {
      const { api } = setup();
      const warn = vi.spyOn(console, 'warn');

      api.navigate('camera');
      await new Promise((r) => setTimeout(r, 150));

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('camera'));
    });

    it('setCurrentActivity(null) closes everything', async () => {
      const { api, ctrl } = setup();
      const navigate = vi.spyOn(ctrl.router, 'navigate');

      api.setCurrentActivity(null);
      await flush();

      expect(navigate).toHaveBeenCalledWith(null);
    });

    it('setCurrentActivity warns when the target activity block never mounts', async () => {
      const { api } = setup();
      const warn = vi.spyOn(console, 'warn');

      api.setCurrentActivity('camera');
      await new Promise((r) => setTimeout(r, 150));

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('camera'));
    });

    it('setCurrentActivity sets the background activity', async () => {
      const { api, ctrl } = setup();
      ctrl.router.activityBlockMounted('upload-list' as never);
      const setActivity = vi.spyOn(ctrl.router, 'setActivity');

      api.setCurrentActivity('upload-list');
      await flush();

      expect(setActivity).toHaveBeenCalledWith('upload-list', undefined);
    });

    it('setModalState(false) closes everything', async () => {
      const { api, ctrl } = setup();
      const navigate = vi.spyOn(ctrl.router, 'navigate');

      api.setModalState(false);
      await flush();

      expect(navigate).toHaveBeenCalledWith(null);
    });

    it('setModalState(true) opens the modal for the intended activity', async () => {
      const { api, ctrl } = setup();
      ctrl.router.setActivity('upload-list' as never);
      ctrl.router.activityBlockMounted('upload-list' as never);
      const openModal = vi.spyOn(ctrl.router, 'openModal');

      api.setModalState(true);
      await flush();

      expect(openModal).toHaveBeenCalledWith('upload-list');
    });

    it('setModalState(true) warns when there is no current activity', async () => {
      const { api } = setup();
      const warn = vi.spyOn(console, 'warn');

      api.setModalState(true);
      await flush();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('setCurrentActivity'));
    });

    it('setModalState(true) keeps the modal closed if the block never mounts', async () => {
      const { api, ctrl } = setup();
      ctrl.router.setActivity('camera' as never);
      const openModal = vi.spyOn(ctrl.router, 'openModal');

      api.setModalState(true);
      await new Promise((r) => setTimeout(r, 1100));

      expect(openModal).not.toHaveBeenCalled();
    });
  });

  describe('events / current activity / history', () => {
    it('on subscribes to uploader events and returns an unsubscribe', () => {
      const { api, ctrl } = setup();
      const handler = vi.fn();
      const unsub = api.on(EventType.UPLOAD_CLICK, handler);

      ctrl.eventEmitter.emit(EventType.UPLOAD_CLICK);
      expect(handler).toHaveBeenCalledTimes(1);

      unsub();
      ctrl.eventEmitter.emit(EventType.UPLOAD_CLICK);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('getCurrentActivity reflects the router state', () => {
      const { api, ctrl } = setup();
      expect(api.getCurrentActivity()).toBeNull();
      ctrl.router.setActivity('upload-list' as never);
      expect(api.getCurrentActivity()).toBe('upload-list');
    });

    it('historyBack delegates to the router', () => {
      const { api, ctrl } = setup();
      const back = vi.spyOn(ctrl.router, 'back');
      api.historyBack();
      expect(back).toHaveBeenCalledTimes(1);
    });
  });

  describe('openSystemDialog', () => {
    afterEach(() => {
      for (const el of document.querySelectorAll('[uploadcare-file-input]')) {
        el.remove();
      }
    });

    it('creates a hidden multiple file input reflecting accept config', () => {
      const { api, ctrl } = setup();
      ctrl.config.set('accept', 'image/*');
      ctrl.config.set('multiple', true);

      api.openSystemDialog();

      const input = document.querySelector<HTMLInputElement>('[uploadcare-file-input]')!;
      expect(input).toBeTruthy();
      expect(input.type).toBe('file');
      expect(input.multiple).toBe(true);
      expect(input.accept).toContain('image/*');
    });

    it('removes previously created inputs before opening a new one', () => {
      const { api } = setup();
      api.openSystemDialog();
      api.openSystemDialog();
      expect(document.querySelectorAll('[uploadcare-file-input]')).toHaveLength(1);
    });

    it('adds the selected files and traverses onFileAdd on change', () => {
      const { api, ctrl } = setup();
      const traverse = vi.spyOn(ctrl.router, 'traverse');

      api.openSystemDialog();
      const input = document.querySelector<HTMLInputElement>('[uploadcare-file-input]')!;
      const file = new File(['x'], 'x.txt', { type: 'text/plain' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change'));

      expect(ctrl.collection.size).toBe(1);
      expect(traverse).toHaveBeenCalledWith('onFileAdd');
    });

    it('includes the img-only accept list when imgOnly is set', () => {
      const { api, ctrl } = setup();
      ctrl.config.set('imgOnly', true);
      ctrl.config.set('accept', '');

      api.openSystemDialog();

      const input = document.querySelector<HTMLInputElement>('[uploadcare-file-input]')!;
      expect(input.accept).toContain('image/');
    });

    it('tags files added via camera capture with the CAMERA source', () => {
      const { api, ctrl } = setup();

      api.openSystemDialog({ captureCamera: true });
      const input = document.querySelector<HTMLInputElement>('[uploadcare-file-input]')!;
      const file = new File(['x'], 'x.jpg', { type: 'image/jpeg' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change'));

      const id = ctrl.collection.items()[0]!;
      expect(ctrl.collection.readProp(id, 'source')).toBe(UploadSource.CAMERA);
    });

    it('uses a photo wildcard for camera capture in photo mode', () => {
      const { api, ctrl } = setup();
      ctrl.config.set('cameraModes', 'photo, video');

      api.openSystemDialog({ captureCamera: true, modeCamera: 'photo' });

      const input = document.querySelector<HTMLInputElement>('[uploadcare-file-input]')!;
      expect(input.accept).toBe(BASIC_IMAGE_WILDCARD);
    });

    it('uses a video wildcard for camera capture in video mode', () => {
      const { api, ctrl } = setup();
      ctrl.config.set('cameraModes', 'photo, video');

      api.openSystemDialog({ captureCamera: true, modeCamera: 'video' });

      const input = document.querySelector<HTMLInputElement>('[uploadcare-file-input]')!;
      expect(input.accept).toBe(BASIC_VIDEO_WILDCARD);
    });

    it('uses a combined wildcard for camera capture without a specific mode', () => {
      const { api, ctrl } = setup();
      ctrl.config.set('cameraModes', 'photo, video');

      api.openSystemDialog({ captureCamera: true });

      const input = document.querySelector<HTMLInputElement>('[uploadcare-file-input]')!;
      expect(input.accept).toContain(BASIC_IMAGE_WILDCARD);
      expect(input.accept).toContain(BASIC_VIDEO_WILDCARD);
    });

    it('is a no-op change handler when the input has no files', () => {
      const { api, ctrl } = setup();
      api.openSystemDialog();
      const input = document.querySelector<HTMLInputElement>('[uploadcare-file-input]')!;
      Object.defineProperty(input, 'files', { value: null, configurable: true });
      input.dispatchEvent(new Event('change'));
      expect(ctrl.collection.size).toBe(0);
    });
  });

  describe('container wiring (M-god step 8a)', () => {
    it('is reachable as bag.api / *publicApi / container.get(UploaderPublicApi) as the same instance', () => {
      const { api, bag, ctx, ctrl } = setup();
      expect(bag.api).toBe(api);
      expect(ctx.read('*publicApi')).toBe(api);
      // M-god step 8b removed `ctrl.api`/`setApi` (the clipboard now `@inject`s
      // the api directly); the single instance is reachable via the container.
      expect(ctrl.container.get(UploaderPublicApiClass)).toBe(api);
    });

    it('throws with a clear message when used before its bag bridge is wired', () => {
      // Resolve a bare api from a container (as the container would) without
      // calling setBagBridge — the bag-dependent methods must fail loudly.
      const container = new ControllerContainer();
      const api = container.get(UploaderPublicApiClass);
      expect(() => api.getOutputCollectionState()).toThrow(/bag bridge/);
    });
  });

  describe('plugin manager @inject (M-god step 8c)', () => {
    it('the api resolves its plugin manager from the container — the same instance as bag.pluginManager / *pluginManager', () => {
      const { bag, ctx, ctrl } = setup();
      const fromContainer = ctrl.container.get(PluginController);
      // `ensurePluginManager` bound + eagerly resolved it, and the `*pluginManager`
      // shared instance is a re-exposer of that exact container instance.
      expect(bag.pluginManager).toBe(fromContainer);
      expect(ctx.read('*pluginManager')).toBe(fromContainer);
    });

    it("initFlow's single-source path reads sources off the container-resolved PluginController the api @injects", async () => {
      const { api, ctrl, bag } = setup();
      ctrl.config.set('sourceList', 'local');
      const onSelect = vi.fn();
      // Register on the container instance (via the bag re-exposer). The api's
      // `@inject(() => PluginController)` must see this exact registry.
      bag.pluginManager.registry.addSource('p', { id: 'local', label: 'Local', onSelect });

      api.initFlow();
      await flush();

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('the container owns PluginController disposal — destroy() runs exactly once on ctx teardown (no double-destroy)', () => {
      const { ctrl, ctxName } = setup();
      const pluginManager = ctrl.container.get(PluginController);
      const destroySpy = vi.spyOn(pluginManager, 'destroy');

      // `deleteCtx` → `destroyCtx` map-walk (skips `.destroy()` for
      // `*pluginManager`, a controllerOwnedInstanceKey) → `container.dispose()`
      // (which calls it once). If the key were NOT controller-owned, the map-walk
      // would destroy it too → 2 calls.
      PubSub.deleteCtx(ctxName);

      expect(destroySpy).toHaveBeenCalledTimes(1);
    });
  });
});
