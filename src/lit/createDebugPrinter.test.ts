import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../abstract/controllers/ConfigController';
import type { ControllerContainer } from '../abstract/di/ControllerContainer';
import { createDebugPrinter } from './createDebugPrinter';

// M-god step 9b-1: `createDebugPrinter` reads the `debug` flag off the ctx's
// `ControllerContainer` (`getContainer().get(ConfigController)`) via a container
// accessor — no longer a `() => ctx`/PubSub facade. The accessor is null-safe
// (pre-adoption → no-op), and the prefix is now just the caller-supplied `name`
// (the `ctx.id` half retired with the ctx).
describe('createDebugPrinter (debug flag from the container ConfigController)', () => {
  const setup = () => {
    const config = new ConfigController();
    // Minimal container stub that hands back this config for `get(ConfigController)`.
    const container = { get: () => config } as unknown as ControllerContainer;
    return { config, container };
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not log while debug is falsy (default)', () => {
    const { container } = setup();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const print = createDebugPrinter(() => container);
    print('hello');
    expect(log).not.toHaveBeenCalled();
  });

  it('logs once debug is enabled', () => {
    const { config, container } = setup();
    config.set('debug', true);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const print = createDebugPrinter(() => container);
    print('hello', 42);
    expect(log).toHaveBeenCalledTimes(1);
    // No ctx.id half anymore; with no `name` the prefix is the empty bracket.
    expect(log).toHaveBeenCalledWith('[]', 'hello', 42);
  });

  it('uses the name as the prefix when provided', () => {
    const { config, container } = setup();
    config.set('debug', true);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const print = createDebugPrinter(() => container, 'PluginController');
    print('msg');
    expect(log).toHaveBeenCalledWith('[PluginController]', 'msg');
  });

  it('is a null-safe no-op before a container is adopted', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Accessor returns null (pre-adoption) — must not throw and must not log.
    const print = createDebugPrinter(() => null, 'DropArea');
    expect(() => print('early')).not.toThrow();
    expect(log).not.toHaveBeenCalled();
  });

  it('resolves a thunk first argument lazily only when logging', () => {
    const { config, container } = setup();
    const resolver = vi.fn(() => ['resolved', 1]);

    // Disabled: the resolver must not run.
    const printOff = createDebugPrinter(() => container);
    printOff(resolver);
    expect(resolver).not.toHaveBeenCalled();

    // Enabled: the resolver runs and its result is spread into the log.
    config.set('debug', true);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const printOn = createDebugPrinter(() => container, 'Scoped');
    printOn(resolver);
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('[Scoped]', 'resolved', 1);
  });
});
