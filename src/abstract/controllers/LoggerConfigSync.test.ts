import { afterEach, describe, expect, it } from 'vitest';
import { ControllerContainer } from '../di/ControllerContainer';
import { __resetLoggerForTests, DEFAULT_LEVEL, logger } from '../logger';
import { ConfigController } from './ConfigController';
import { LoggerConfigSync } from './LoggerConfigSync';

// The sync's cross-ctx aggregation is module-level, so dispose every container
// created in a test (running each LoggerConfigSync.destroy → clears its source)
// and reset the logger level between cases.
const containers: ControllerContainer[] = [];
afterEach(() => {
  for (const c of containers.splice(0)) {
    c.dispose();
  }
  __resetLoggerForTests();
});

/** A ctx = one container; getting LoggerConfigSync runs its `init()` (subscribes). */
const newCtx = () => {
  const container = new ControllerContainer();
  containers.push(container);
  container.get(LoggerConfigSync);
  return { container, config: container.get(ConfigController) };
};

describe('LoggerConfigSync', () => {
  it('maps debug:false to the default level and debug:true to `debug`', () => {
    const { config } = newCtx();
    expect(logger.level).toBe(DEFAULT_LEVEL);

    config.set('debug', true);
    expect(logger.level).toBe('debug');

    config.set('debug', false);
    expect(logger.level).toBe(DEFAULT_LEVEL);
  });

  it('reflects a debug flag set before the sync is created (init reads current value)', () => {
    const container = new ControllerContainer();
    containers.push(container);
    container.get(ConfigController).set('debug', true);
    container.get(LoggerConfigSync); // init() applies the already-set value
    expect(logger.level).toBe('debug');
  });

  it('aggregates across ctxs: the noisiest live ctx wins', () => {
    const a = newCtx();
    const b = newCtx();

    a.config.set('debug', true);
    expect(logger.level).toBe('debug'); // one ctx wants debug → global debug

    b.config.set('debug', false);
    expect(logger.level).toBe('debug'); // b never wanted debug; a still does

    a.config.set('debug', false);
    expect(logger.level).toBe(DEFAULT_LEVEL); // no live ctx wants debug
  });

  it('disposing a debug-enabled ctx removes its contribution', () => {
    const a = newCtx();
    const b = newCtx();
    a.config.set('debug', true);
    b.config.set('debug', true);
    expect(logger.level).toBe('debug');

    a.container.dispose(); // runs LoggerConfigSync.destroy()
    expect(logger.level).toBe('debug'); // b still wants debug

    b.container.dispose();
    expect(logger.level).toBe(DEFAULT_LEVEL); // no ctx left
  });

  it('destroy() unsubscribes: a later config change on a disposed ctx does not affect the level', () => {
    const { container, config } = newCtx();
    container.dispose();
    config.set('debug', true);
    expect(logger.level).toBe(DEFAULT_LEVEL);
  });
});
