import { afterEach, describe, expect, it, vi } from 'vitest';
import { controllerLogger } from './controllerLogger';
import { ConfigController } from './controllers/ConfigController';
import { ControllerContainer } from './di/ControllerContainer';
import { EventBus } from './EventBus';
import { __resetLoggerForTests } from './logger';

afterEach(() => {
  __resetLoggerForTests();
  vi.restoreAllMocks();
});

describe('controllerLogger (per-ctx verbose gate through the DI boundary)', () => {
  it('gates verbose output per container: A (debug on) prints, B (debug off) stays silent', () => {
    const containerA = new ControllerContainer();
    const containerB = new ControllerContainer();
    containerA.get(ConfigController).set('debug', true);
    containerB.get(ConfigController).set('debug', false);

    // Tag each logger to a real container-built controller instance (the common
    // `controllerLogger(this, scope)` shape): the verbose gate must resolve each
    // instance's OWN `ConfigController` through `containerOf`, not a shared one.
    const logA = controllerLogger(containerA.get(EventBus), 'x');
    const logB = controllerLogger(containerB.get(EventBus), 'x');

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    logA.debug('from-a');
    logB.debug('from-b');

    // Only A's ctx has `debug` on, so only A's verbose line prints — proving the
    // gate is per-ctx at the DI boundary, not global.
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.at(-1)).toBe('from-a');
  });
});
