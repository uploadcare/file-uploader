import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TelemetryManager } from '../../../abstract/managers/TelemetryManager';
import { initialConfig } from '../../../blocks/Config/initialConfig';
import type { SharedInstancesBag } from '../../../lit/shared-instances';
import type { ConfigType } from '../../../types';
import { AuthTokenManager } from '../AuthTokenManager';

const createSharedInstancesBag = (cfg: ConfigType): SharedInstancesBag => {
  const telemetryManager = {
    sendEventError: vi.fn(),
  } as unknown as TelemetryManager;

  const ctx = {
    read: vi.fn((key: string) => cfg[key.replace('*cfg/', '') as keyof ConfigType] ?? null),
    has: vi.fn().mockReturnValue(true),
  } as unknown as SharedInstancesBag['ctx'];

  return {
    get ctx() {
      return ctx;
    },
    get modalManager() {
      return null;
    },
    get telemetryManager() {
      return telemetryManager;
    },
  } as unknown as SharedInstancesBag;
};

/** `_cfg` is a getter over the context, so the config object is what changes. */
const createManager = (cfgOverrides: Partial<ConfigType> = {}) => {
  const cfg: ConfigType = { ...initialConfig, ...cfgOverrides };
  const manager = new AuthTokenManager(createSharedInstancesBag(cfg));
  (manager as unknown as { _debugPrint: () => void })._debugPrint = vi.fn();
  return { manager, cfg };
};

/** A token the cache can read `exp` out of. The signature is never checked. */
const tokenExpiringIn = (seconds: number) => {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${payload}.signature`;
};

describe('AuthTokenManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Nothing resets timer state after the last test in a file, so a worker
    // reused for another spec would inherit fake timers.
    vi.useRealTimers();
  });

  it.each([null, undefined, ''])('returns undefined, so no token is sent, when authToken is %p', (value) => {
    const { manager } = createManager({ authToken: value as unknown as null });

    expect(manager.getAuthToken()).toBeUndefined();
  });

  it('passes a plain string straight through', () => {
    // The SSR shape: the token is already minted, nothing to cache.
    expect(createManager({ authToken: 'eyJ' }).manager.getAuthToken()).toBe('eyJ');
  });

  it('caches a resolver so upload-client does not refetch per request', async () => {
    const fetchToken = vi.fn(() => tokenExpiringIn(3600));
    const { manager } = createManager({ authToken: fetchToken });

    const resolve = manager.getAuthToken() as () => Promise<string>;
    await resolve();
    await resolve();

    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it('keeps the cached token when the resolver identity changes', async () => {
    // React passes a new closure on every render; the token must survive it.
    const first = vi.fn(() => tokenExpiringIn(3600));
    const { manager, cfg } = createManager({ authToken: first });
    const token = await (manager.getAuthToken() as () => Promise<string>)();

    const second = vi.fn(() => tokenExpiringIn(3600));
    cfg.authToken = second;

    expect(await (manager.getAuthToken() as () => Promise<string>)()).toBe(token);
    expect(second).not.toHaveBeenCalled();
  });

  it('keeps the function it was handed, while a new call follows the config', async () => {
    // A request already under way keeps the token function it started with;
    // whoever needs the current value asks again.
    const first = vi.fn(async () => tokenExpiringIn(3600));
    const { manager, cfg } = createManager({ authToken: first });
    const stored = manager.getAuthToken() as () => Promise<string>;

    const second = vi.fn(async () => tokenExpiringIn(3600));
    cfg.authToken = second;
    manager.invalidate();
    await stored();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();

    manager.invalidate();
    await (manager.getAuthToken() as () => Promise<string>)();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('returns undefined once authToken is unset, so no request is signed', () => {
    const { manager, cfg } = createManager({ authToken: vi.fn(async () => tokenExpiringIn(3600)) });
    expect(typeof manager.getAuthToken()).toBe('function');

    cfg.authToken = null;

    expect(manager.getAuthToken()).toBeUndefined();
  });

  it('returns a plain token once authToken switches from a function to a string', () => {
    const { manager, cfg } = createManager({ authToken: vi.fn(async () => tokenExpiringIn(3600)) });

    cfg.authToken = 'eyJ.plain.sig';

    expect(manager.getAuthToken()).toBe('eyJ.plain.sig');
  });

  it('refetches after invalidate()', async () => {
    const fetchToken = vi.fn(() => tokenExpiringIn(3600));
    const { manager } = createManager({ authToken: fetchToken });

    await (manager.getAuthToken() as () => Promise<string>)();
    manager.invalidate();
    await (manager.getAuthToken() as () => Promise<string>)();

    expect(fetchToken).toHaveBeenCalledTimes(2);
  });
});
