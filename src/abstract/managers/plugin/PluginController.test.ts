import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TypedData } from '../../TypedData';
import { initialUploadEntryData, type UploadEntryData, type UploadEntryTypedData } from '../../uploadEntrySchema';
import { PluginController, type PluginControllerDeps } from './PluginController';
import type { PluginRegistry } from './PluginRegistry';
import type { PluginApi, PluginUploaderApi, UploaderPlugin } from './PluginTypes';

// A `buildApi` that wires the registry register* methods onto the real registry,
// so registrations show up in `snapshot()` / get purged on unregister. Pushes a
// tracked unsub into `configSubscriptions` to exercise the error-cleanup path.
const setup = () => {
  let onCompute: ((p: Promise<UploaderPlugin[] | undefined>) => void) | undefined;
  const unwatch = vi.fn();
  const getUploaderApi = vi.fn(() => ({}) as PluginUploaderApi);
  const debug = vi.fn();
  const configUnsubs: Array<ReturnType<typeof vi.fn>> = [];

  const buildApi: PluginControllerDeps['buildApi'] = (registry: PluginRegistry, pluginId, configSubscriptions) => {
    const sub = vi.fn();
    configUnsubs.push(sub);
    configSubscriptions.push(sub);
    const registryApi: PluginApi['registry'] = {
      registerSource: (s) => registry.addSource(pluginId, s),
      registerActivity: (a) => registry.addActivity(pluginId, a),
      registerFileAction: (a) => registry.addFileAction(pluginId, a),
      registerFileHook: (h) => registry.addFileHook(pluginId, h),
      registerIcon: (i) => registry.addIcon(pluginId, i),
      registerL10n: () => {},
      registerConfig: () => {},
    };
    return {
      registry: registryApi,
      config: { get: () => undefined, subscribe: () => () => {} },
      activity: { getParams: () => ({}), subscribeToParams: () => () => {} },
      files: { update: () => {} },
    } as unknown as PluginApi;
  };

  const controller = new PluginController({
    buildApi,
    getUploaderApi,
    watchPlugins: (cb) => {
      onCompute = cb;
      return unwatch;
    },
    debug,
  });

  const sync = async (plugins: UploaderPlugin[] | undefined) => {
    onCompute?.(Promise.resolve(plugins));
    await controller.pluginsReady();
  };

  return { controller, sync, getUploaderApi, debug, unwatch, configUnsubs };
};

const sourcePlugin = (id: string, setup?: UploaderPlugin['setup']): UploaderPlugin => ({
  id,
  setup:
    setup ??
    (({ pluginApi }) => {
      pluginApi.registry.registerSource({ id, label: id, icon: id, onSelect: () => {} });
    }),
});

describe('PluginController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('install / sync', () => {
    it('registers a plugin: builds api, calls setup with the uploader api, surfaces its registrations', async () => {
      const t = setup();
      const onChange = vi.fn();
      t.controller.onPluginsChange(onChange);

      await t.sync([sourcePlugin('a')]);

      expect(t.getUploaderApi).toHaveBeenCalled();
      expect(t.controller.snapshot().sources.map((s) => s.id)).toEqual(['a']);
      expect(onChange).toHaveBeenCalled();
    });

    it('skips a plugin missing an id', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const t = setup();

      await t.sync([{ id: '', setup: () => {} }]);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('missing the required "id"'));
      expect(t.controller.snapshot().sources).toHaveLength(0);
    });

    it('skips a duplicate id within the same sync', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const t = setup();
      const setupSpy = vi.fn(({ pluginApi }: Parameters<UploaderPlugin['setup']>[0]) =>
        pluginApi.registry.registerSource({ id: 'dup', label: 'dup', icon: 'dup', onSelect: () => {} }),
      );

      await t.sync([sourcePlugin('dup', setupSpy), sourcePlugin('dup', setupSpy)]);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('already in the list'));
      expect(setupSpy).toHaveBeenCalledTimes(1);
    });

    it('does not re-register an already-installed plugin on a later sync', async () => {
      const t = setup();
      const setupSpy = vi.fn(sourcePlugin('a').setup);
      await t.sync([sourcePlugin('a', setupSpy)]);
      await t.sync([sourcePlugin('a', setupSpy)]); // still present → no re-setup

      expect(setupSpy).toHaveBeenCalledTimes(1);
    });

    it('isolates a plugin whose setup throws: purges, logs, keeps others, cleans config subs', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const t = setup();
      const boom = sourcePlugin('boom', ({ pluginApi }) => {
        pluginApi.registry.registerSource({ id: 'boom', label: 'b', icon: 'b', onSelect: () => {} });
        throw new Error('setup failed');
      });

      await t.sync([boom, sourcePlugin('ok')]);

      expect(error).toHaveBeenCalledWith(expect.stringContaining('"boom" setup() threw'), expect.any(Error));
      expect(t.controller.snapshot().sources.map((s) => s.id)).toEqual(['ok']); // boom purged
      expect(t.configUnsubs[0]).toHaveBeenCalled(); // its config sub was cleaned up
    });

    it('unregisters a plugin dropped from a later sync: purges + disposes', async () => {
      const t = setup();
      const dispose = vi.fn();
      await t.sync([
        sourcePlugin('a', ({ pluginApi }) => {
          pluginApi.registry.registerSource({ id: 'a', label: 'a', icon: 'a', onSelect: () => {} });
          return dispose;
        }),
      ]);
      expect(t.controller.snapshot().sources).toHaveLength(1);

      await t.sync([]); // 'a' gone

      expect(dispose).toHaveBeenCalledTimes(1);
      expect(t.controller.snapshot().sources).toHaveLength(0);
    });

    it('ignores an undefined plugin list from the loader', async () => {
      const t = setup();
      await expect(t.sync(undefined)).resolves.toBeUndefined();
      expect(t.controller.snapshot().sources).toHaveLength(0);
    });
  });

  describe('onPluginsChange', () => {
    it('stops notifying after unsubscribe', async () => {
      const t = setup();
      const onChange = vi.fn();
      const unsub = t.controller.onPluginsChange(onChange);
      unsub();

      await t.sync([sourcePlugin('a')]);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('isolates a throwing subscriber so others still run', async () => {
      const t = setup();
      const good = vi.fn();
      t.controller.onPluginsChange(() => {
        throw new Error('subscriber boom');
      });
      t.controller.onPluginsChange(good);

      await expect(t.sync([sourcePlugin('a')])).resolves.toBeUndefined();
      expect(good).toHaveBeenCalled();
    });
  });

  describe('runOnAddHooks', () => {
    const makeEntry = (file: File | null): UploadEntryTypedData => {
      const entry = new TypedData<UploadEntryData>(initialUploadEntryData);
      if (file) entry.setValue('file', file);
      return entry;
    };

    const withOnAddHook = (handler: (ctx: { file: File | Blob; signal: AbortSignal }) => unknown, timeout = 30000) =>
      sourcePlugin('hookplugin', ({ pluginApi }) => {
        pluginApi.registry.registerFileHook({ type: 'onAdd', handler: handler as never, timeout });
      });

    it('runs the onAdd hook chain and re-derives file fields on transform', async () => {
      const t = setup();
      const newFile = new File(['transformed-bytes'], 'new.png', { type: 'image/png' });
      await t.sync([withOnAddHook(() => ({ file: newFile }))]);
      const entry = makeEntry(new File(['x'], 'a.txt'));

      await t.controller.runOnAddHooks(entry);

      expect(entry.getValue('file')).toBe(newFile);
      expect(entry.getValue('fileName')).toBe('new.png');
      expect(entry.getValue('mimeType')).toBe('image/png');
      expect(entry.getValue('isImage')).toBe(true);
      expect(entry.getValue('fileSize')).toBe(newFile.size);
    });

    it('no-ops when the entry has no file', async () => {
      const t = setup();
      const handler = vi.fn();
      await t.sync([withOnAddHook(handler)]);

      await t.controller.runOnAddHooks(makeEntry(null));

      expect(handler).not.toHaveBeenCalled();
    });

    it('no-ops when there are no onAdd hooks', async () => {
      const t = setup();
      await t.sync([sourcePlugin('a')]);
      const entry = makeEntry(new File(['x'], 'a.txt'));
      const original = entry.getValue('file');

      await t.controller.runOnAddHooks(entry);

      expect(entry.getValue('file')).toBe(original);
    });

    it('isolates a throwing hook and keeps the original file', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const t = setup();
      await t.sync([
        withOnAddHook(() => {
          throw new Error('hook boom');
        }),
      ]);
      const original = new File(['x'], 'a.txt');
      const entry = makeEntry(original);

      await t.controller.runOnAddHooks(entry);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('onAdd'), expect.any(Error));
      expect(entry.getValue('file')).toBe(original);
    });

    it('applies a Blob-returning hook without touching fileName', async () => {
      const t = setup();
      const newBlob = new Blob(['data'], { type: 'text/plain' });
      await t.sync([withOnAddHook(() => ({ file: newBlob }))]);
      const entry = makeEntry(new File(['x'], 'a.txt'));
      entry.setValue('fileName', 'original.txt');

      await t.controller.runOnAddHooks(entry);

      expect(entry.getValue('file')).toBe(newBlob);
      expect(entry.getValue('fileName')).toBe('original.txt'); // unchanged — a Blob has no name
      expect(entry.getValue('mimeType')).toBe('text/plain');
    });

    it('skips a hook that exceeds its timeout', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const t = setup();
      await t.sync([withOnAddHook(() => new Promise(() => {}), 50)]);
      const entry = makeEntry(new File(['x'], 'a.txt'));

      const promise = t.controller.runOnAddHooks(entry);
      await vi.advanceTimersByTimeAsync(60);
      await promise;

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('onAdd'), expect.any(Error));
    });
  });

  describe('lifecycle', () => {
    it('destroy() unregisters all plugins, destroys the registry, and tears down the watcher', async () => {
      const t = setup();
      const dispose = vi.fn();
      await t.sync([
        sourcePlugin('a', ({ pluginApi }) => {
          pluginApi.registry.registerSource({ id: 'a', label: 'a', icon: 'a', onSelect: () => {} });
          return dispose;
        }),
      ]);

      t.controller.destroy();

      expect(dispose).toHaveBeenCalledTimes(1);
      expect(t.controller.snapshot().sources).toHaveLength(0);
      expect(t.unwatch).toHaveBeenCalled();
    });

    it('exposes the config registry', () => {
      const t = setup();
      expect(t.controller.configRegistry).toBe(t.controller.registry.config);
    });

    it('logs (via debug) when a config-subscription throws during error cleanup', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const debug = vi.fn();
      let onCompute: ((p: Promise<UploaderPlugin[] | undefined>) => void) | undefined;
      const controller = new PluginController({
        buildApi: (_registry, _pluginId, subs) => {
          subs.push(() => {
            throw new Error('unsub boom');
          });
          return {} as PluginApi;
        },
        getUploaderApi: () => ({}) as PluginUploaderApi,
        watchPlugins: (cb) => {
          onCompute = cb;
          return () => {};
        },
        debug,
      });

      onCompute?.(
        Promise.resolve([
          {
            id: 'x',
            setup: () => {
              throw new Error('setup boom');
            },
          },
        ]),
      );
      await controller.pluginsReady();

      expect(debug).toHaveBeenCalledWith('Failed to unsubscribe config listener', expect.any(Error));
    });

    it('logs when a config-subscription throws during unregister, with debug defaulting to a no-op', async () => {
      let onCompute: ((p: Promise<UploaderPlugin[] | undefined>) => void) | undefined;
      const controller = new PluginController({
        buildApi: (_registry, _pluginId, subs) => {
          subs.push(() => {
            throw new Error('unsub boom');
          });
          return {} as PluginApi;
        },
        getUploaderApi: () => ({}) as PluginUploaderApi,
        watchPlugins: (cb) => {
          onCompute = cb;
          return () => {};
        },
        // no debug → exercises the no-op default on the cleanup path
      });

      onCompute?.(Promise.resolve([{ id: 'x', setup: () => {} }]));
      await controller.pluginsReady();
      onCompute?.(Promise.resolve([])); // remove 'x' → unregister → throwing sub caught
      await expect(controller.pluginsReady()).resolves.toBeUndefined();
    });
  });
});
