import { describe, expect, it } from 'vitest';
import type { PubSub } from '../../../lit/PubSubCompat';
import type { SharedState } from '../../../lit/SharedState';
import { delay } from '../../../utils/delay';
import { ConfigController } from '../../controllers/ConfigController';
import { type LazyPluginEntry, LazyPluginLoader } from './LazyPluginLoader';
import type { UploaderPlugin } from './PluginTypes';

// M-god step 7: `LazyPluginLoader` reads config directly off a `ConfigController`
// (`plugins` + each entry's `configDeps`) instead of the `*cfg/*` PubSub facade.
// `*lazyPlugins` itself still comes off the ctx (routed to `LazyPluginsController`).
const makePlugin = (id: string): UploaderPlugin => ({ id, setup: async () => undefined });

const setup = () => {
  const config = new ConfigController();
  config.set('plugins', []);
  let lazyPluginsCb: ((entries: LazyPluginEntry[] | null) => void) | undefined;
  const ctx = {
    sub: (key: string, cb: (value: unknown) => void) => {
      if (key === '*lazyPlugins') {
        lazyPluginsCb = cb as (entries: LazyPluginEntry[] | null) => void;
      }
      return () => {};
    },
  } as unknown as PubSub<SharedState>;

  const computed: Promise<UploaderPlugin[] | undefined>[] = [];
  const loader = new LazyPluginLoader(ctx, config, (p) => computed.push(p));
  const setEntries = (entries: LazyPluginEntry[]) => lazyPluginsCb?.(entries);
  return { config, loader, computed, setEntries };
};

describe('LazyPluginLoader (direct ConfigController)', () => {
  it('resolves enabled lazy plugins and appends them to the user plugins', async () => {
    const { config, computed, setEntries } = setup();
    config.set('plugins', [makePlugin('user')]);
    const entry: LazyPluginEntry = {
      configDeps: ['multiple'],
      isEnabled: (get) => Boolean(get('multiple')),
      load: () => makePlugin('lazy'),
    };
    config.set('multiple', true);
    setEntries([entry]);

    const result = await computed.at(-1);
    expect(result?.map((p) => p.id)).toEqual(['user', 'lazy']);
  });

  it('omits a disabled lazy plugin', async () => {
    const { config, computed, setEntries } = setup();
    config.set('multiple', false);
    setEntries([
      {
        configDeps: ['multiple'],
        isEnabled: (get) => Boolean(get('multiple')),
        load: () => makePlugin('lazy'),
      },
    ]);
    const result = await computed.at(-1);
    expect(result?.map((p) => p.id)).toEqual([]);
  });

  it('recomputes when a declared config dep changes', async () => {
    const { config, computed, setEntries } = setup();
    config.set('multiple', false);
    setEntries([
      {
        configDeps: ['multiple'],
        isEnabled: (get) => Boolean(get('multiple')),
        load: () => makePlugin('lazy'),
      },
    ]);
    const countAfterSet = computed.length;
    expect(await computed.at(-1)).toEqual([]);

    config.set('multiple', true);
    expect(computed.length).toBe(countAfterSet + 1);
    expect((await computed.at(-1))?.map((p) => p.id)).toEqual(['lazy']);
  });

  it('does not recompute when an undeclared config key changes (per-key dedup)', async () => {
    const { config, computed, setEntries } = setup();
    setEntries([
      {
        configDeps: ['multiple'],
        isEnabled: () => true,
        load: () => makePlugin('lazy'),
      },
    ]);
    await delay(0);
    const countBefore = computed.length;

    // `sourceList` is not a declared dep and not `plugins` — must not recompute.
    config.set('sourceList', 'local');
    expect(computed.length).toBe(countBefore);
  });

  it('recomputes when the `plugins` key changes even without entry deps', async () => {
    const { config, computed, setEntries } = setup();
    setEntries([{ configDeps: [], isEnabled: () => false, load: () => makePlugin('lazy') }]);
    const countBefore = computed.length;

    config.set('plugins', [makePlugin('user')]);
    expect(computed.length).toBe(countBefore + 1);
    expect((await computed.at(-1))?.map((p) => p.id)).toEqual(['user']);
  });

  it('stops recomputing after destroy', async () => {
    const { config, computed, setEntries, loader } = setup();
    setEntries([{ configDeps: ['multiple'], isEnabled: () => true, load: () => makePlugin('lazy') }]);
    loader.destroy();
    const countAfterDestroy = computed.length;

    config.set('multiple', true);
    expect(computed.length).toBe(countAfterDestroy);
  });
});
