import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../abstract/controllers/ConfigController';
import { createDebugPrinter } from './createDebugPrinter';
import type { PubSub } from './PubSubCompat';
import type { SharedState } from './SharedState';

// M-god step 7: `createDebugPrinter` reads the `debug` flag directly off the
// ctx's `ConfigController` (was `ctx.read(sharedConfigKey('debug'))`), while
// still using the ctx for its `id` prefix — so callers keep passing `() => ctx`.
describe('createDebugPrinter (debug flag from ConfigController)', () => {
  const setup = () => {
    const config = new ConfigController();
    // M-god step 8e: `createDebugPrinter` resolves the ctx's `ConfigController`
    // via `ctx.container().get(ConfigController)` (the facade `uploaderController()`
    // is gone). Mock a minimal container that hands back this config.
    const ctx = {
      id: 'my-ctx',
      container: () => ({ get: () => config }),
    } as unknown as PubSub<SharedState>;
    return { config, ctx };
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not log while debug is falsy (default)', () => {
    const { ctx } = setup();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const print = createDebugPrinter(() => ctx);
    print('hello');
    expect(log).not.toHaveBeenCalled();
  });

  it('logs with the ctx id prefix once debug is enabled', () => {
    const { config, ctx } = setup();
    config.set('debug', true);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const print = createDebugPrinter(() => ctx);
    print('hello', 42);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('[my-ctx]', 'hello', 42);
  });

  it('includes the scope in the prefix when provided', () => {
    const { config, ctx } = setup();
    config.set('debug', true);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const print = createDebugPrinter(() => ctx, 'PluginController');
    print('msg');
    expect(log).toHaveBeenCalledWith('[my-ctx][PluginController]', 'msg');
  });

  it('resolves a thunk first argument lazily only when logging', () => {
    const { config, ctx } = setup();
    const resolver = vi.fn(() => ['resolved', 1]);

    // Disabled: the resolver must not run.
    const printOff = createDebugPrinter(() => ctx);
    printOff(resolver);
    expect(resolver).not.toHaveBeenCalled();

    // Enabled: the resolver runs and its result is spread into the log.
    config.set('debug', true);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const printOn = createDebugPrinter(() => ctx);
    printOn(resolver);
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('[my-ctx]', 'resolved', 1);
  });
});
