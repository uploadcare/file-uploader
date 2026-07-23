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
  const configUnsubs: Array<ReturnType<typeof vi.fn>> = [];

  const buildApi: PluginControllerDeps['buildApi'] = (registry: PluginRegistry, pluginId, configSubscriptions, log) => {
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
      router: { traverse: () => {} },
      logger: log,
    } as unknown as PluginApi;
  };

  const controller = new PluginController({
    buildApi,
    getUploaderApi,
    watchPlugins: (cb) => {
      onCompute = cb;
      return unwatch;
    },
  });

  const sync = async (plugins: UploaderPlugin[] | undefined) => {
    onCompute?.(Promise.resolve(plugins));
    await controller.pluginsReady();
  };
  const push = (pluginsPromise: Promise<UploaderPlugin[] | undefined>) => onCompute?.(pluginsPromise);

  return { controller, sync, push, getUploaderApi, unwatch, configUnsubs };
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

    it('exposes a logger scoped to the plugin on pluginApi.logger (`[uc][plugin:<id>]`)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const t = setup();
      let received: { pluginApi?: { logger?: { warn?: unknown } } } | undefined;
      const plugin: UploaderPlugin = {
        id: 'my-plugin',
        setup: (params) => {
          received = params;
          params.pluginApi.logger.warn('hello from plugin');
        },
      };

      await t.sync([plugin]);

      expect(typeof received?.pluginApi?.logger?.warn).toBe('function');
      expect(warn).toHaveBeenCalledWith('[uc][plugin:my-plugin]', 'hello from plugin');
    });

    it('skips a plugin missing an id', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const t = setup();

      await t.sync([{ id: '', setup: () => {} }]);

      expect(warn).toHaveBeenCalledWith('[uc][plugin-manager]', expect.stringContaining('missing the required "id"'));
      expect(t.controller.snapshot().sources).toHaveLength(0);
    });

    it('skips a duplicate id within the same sync', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const t = setup();
      const setupSpy = vi.fn(({ pluginApi }: Parameters<UploaderPlugin['setup']>[0]) =>
        pluginApi.registry.registerSource({ id: 'dup', label: 'dup', icon: 'dup', onSelect: () => {} }),
      );

      await t.sync([sourcePlugin('dup', setupSpy), sourcePlugin('dup', setupSpy)]);

      expect(warn).toHaveBeenCalledWith('[uc][plugin-manager]', expect.stringContaining('already in the list'));
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

      expect(error).toHaveBeenCalledWith(
        '[uc][plugin-manager]',
        expect.stringContaining('"boom" setup() threw'),
        expect.any(Error),
      );
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

    it('isolates a throwing plugin dispose during unregister and still completes cleanup', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const t = setup();
      const dispose = vi.fn(() => {
        throw new Error('dispose boom');
      });
      await t.sync([
        sourcePlugin('a', ({ pluginApi }) => {
          pluginApi.registry.registerSource({ id: 'a', label: 'a', icon: 'a', onSelect: () => {} });
          return dispose;
        }),
      ]);

      await expect(t.sync([])).resolves.toBeUndefined(); // unregister doesn't throw
      expect(dispose).toHaveBeenCalled();
      expect(t.controller.snapshot().sources).toHaveLength(0); // cleanup still ran
      expect(warn).toHaveBeenCalledWith('[uc][plugin-manager]', 'Failed to dispose plugin', expect.any(Error));
    });

    it('recovers the sync queue after a rejected emission so later syncs still run', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const t = setup();

      t.push(Promise.reject(new Error('load failed')));
      await t.controller.pluginsReady(); // must not reject

      expect(errorSpy).toHaveBeenCalledWith(
        '[uc][plugin-manager]',
        expect.stringContaining('Failed to sync plugins'),
        expect.any(Error),
      );

      await t.sync([sourcePlugin('a')]); // queue recovered → still processes
      expect(t.controller.snapshot().sources.map((s) => s.id)).toEqual(['a']);
    });

    it('skips a queued emission that arrives after destroy()', async () => {
      const t = setup();
      t.controller.destroy();

      t.push(Promise.resolve([sourcePlugin('late')]));
      await t.controller.pluginsReady();

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
      if (file) entry.set('file', file);
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

      expect(entry.get('file')).toBe(newFile);
      expect(entry.get('fileName')).toBe('new.png');
      expect(entry.get('mimeType')).toBe('image/png');
      expect(entry.get('isImage')).toBe(true);
      expect(entry.get('fileSize')).toBe(newFile.size);
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
      const original = entry.get('file');

      await t.controller.runOnAddHooks(entry);

      expect(entry.get('file')).toBe(original);
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

      expect(warn).toHaveBeenCalledWith('[uc][plugin-manager]', expect.stringContaining('onAdd'), expect.any(Error));
      expect(entry.get('file')).toBe(original);
    });

    it('applies a Blob-returning hook without touching fileName', async () => {
      const t = setup();
      const newBlob = new Blob(['data'], { type: 'text/plain' });
      await t.sync([withOnAddHook(() => ({ file: newBlob }))]);
      const entry = makeEntry(new File(['x'], 'a.txt'));
      entry.set('fileName', 'original.txt');

      await t.controller.runOnAddHooks(entry);

      expect(entry.get('file')).toBe(newBlob);
      expect(entry.get('fileName')).toBe('original.txt'); // unchanged — a Blob has no name
      expect(entry.get('mimeType')).toBe('text/plain');
    });

    it('skips a hook that exceeds its timeout', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const t = setup();
      await t.sync([withOnAddHook(() => new Promise(() => {}), 50)]);
      const entry = makeEntry(new File(['x'], 'a.txt'));

      const promise = t.controller.runOnAddHooks(entry);
      await vi.advanceTimersByTimeAsync(60);
      await promise;

      expect(warn).toHaveBeenCalledWith('[uc][plugin-manager]', expect.stringContaining('onAdd'), expect.any(Error));
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

    it('warns when a config-subscription throws during error cleanup', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
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

      expect(warn).toHaveBeenCalledWith(
        '[uc][plugin-manager]',
        'Failed to unsubscribe config listener',
        expect.any(Error),
      );
    });

    it('contains a config-subscription that throws during unregister', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
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
      });

      onCompute?.(Promise.resolve([{ id: 'x', setup: () => {} }]));
      await controller.pluginsReady();
      onCompute?.(Promise.resolve([])); // remove 'x' → unregister → throwing sub caught
      await expect(controller.pluginsReady()).resolves.toBeUndefined();
    });
  });
});
