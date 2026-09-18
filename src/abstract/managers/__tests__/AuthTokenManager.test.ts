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

  it('returns undefined when authToken is not configured', () => {
    expect(createManager().manager.getAuthToken()).toBeUndefined();
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

  it('refetches after invalidate()', async () => {
    const fetchToken = vi.fn(() => tokenExpiringIn(3600));
    const { manager } = createManager({ authToken: fetchToken });

    await (manager.getAuthToken() as () => Promise<string>)();
    manager.invalidate();
    await (manager.getAuthToken() as () => Promise<string>)();

    expect(fetchToken).toHaveBeenCalledTimes(2);
  });
});
