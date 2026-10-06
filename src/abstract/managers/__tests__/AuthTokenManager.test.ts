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

/** `getAuthToken()` hands back a provider; this is its token function. */
const resolverOf = (manager: AuthTokenManager): (() => Promise<string>) => {
  const authToken = manager.getAuthToken();
  if (!authToken || typeof authToken !== 'object') {
    throw new Error(`expected a provider, got ${typeof authToken}`);
  }
  return authToken.getToken as () => Promise<string>;
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

    const resolve = resolverOf(manager);
    await resolve();
    await resolve();

    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it('keeps the cached token when the resolver identity changes', async () => {
    // React passes a new closure on every render; the token must survive it.
    const first = vi.fn(() => tokenExpiringIn(3600));
    const { manager, cfg } = createManager({ authToken: first });
    const token = await resolverOf(manager)();

    const second = vi.fn(() => tokenExpiringIn(3600));
    cfg.authToken = second;

    expect(await resolverOf(manager)()).toBe(token);
    expect(second).not.toHaveBeenCalled();
  });

  it('keeps the function it was handed, while a new call follows the config', async () => {
    // A request already under way keeps the token function it started with;
    // whoever needs the current value asks again.
    const first = vi.fn(async () => tokenExpiringIn(3600));
    const { manager, cfg } = createManager({ authToken: first });
    const stored = resolverOf(manager);

    const second = vi.fn(async () => tokenExpiringIn(3600));
    cfg.authToken = second;
    manager.invalidate();
    await stored();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();

    // One `invalidate()`, not two. A second here would hide the retained
    // provider having refilled the cache on the line above.
    await resolverOf(manager)();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('does not let a retained provider hand the next upload the previous token', async () => {
    // The signed-in user changes mid-upload. The upload already running keeps
    // the provider it started with, and asking it again must not put that
    // user's token back where the next upload would find it.
    // Distinct lifetimes, so the two differ. Fake timers freeze `Date.now()`,
    // so the same lifetime twice would produce the same string and the
    // assertions below would hold whichever token came back.
    const tokenA = tokenExpiringIn(3600);
    const tokenB = tokenExpiringIn(7200);
    const { manager, cfg } = createManager({ authToken: vi.fn(async () => tokenA) });

    const retained = manager.getAuthToken();
    if (!retained || typeof retained !== 'object') throw new Error('expected a provider');
    expect(await retained.getToken()).toBe(tokenA);

    const resolverB = vi.fn(async () => tokenB);
    cfg.authToken = resolverB;
    manager.invalidate();

    // The old upload asks again before the new one starts.
    expect(await retained.getToken()).toBe(tokenA);

    expect(await resolverOf(manager)()).toBe(tokenB);
    expect(resolverB).toHaveBeenCalledTimes(1);
  });

  it('does not let a retained provider drop the token the next upload cached', async () => {
    // The refusal arrives late: the user has already changed and the new
    // upload has a token of its own. Dropping that one would make the new
    // upload refetch for a rejection that was never about its token.
    const { manager, cfg } = createManager({ authToken: vi.fn(async () => tokenExpiringIn(3600)) });

    const retained = manager.getAuthToken();
    if (!retained || typeof retained !== 'object') throw new Error('expected a provider');
    await retained.getToken();

    const resolverB = vi.fn(async () => tokenExpiringIn(7200));
    cfg.authToken = resolverB;
    manager.invalidate();

    const current = resolverOf(manager);
    await current();
    expect(resolverB).toHaveBeenCalledTimes(1);

    // Upload A's token is refused, long after it stopped being anyone's token.
    retained.invalidate?.();

    await current();
    expect(resolverB).toHaveBeenCalledTimes(1);
  });

  it('drops only the cached token when upload-client reports a refusal', async () => {
    // A provider configured directly owns its token and is handed to
    // upload-client as it is, so it gets its own `invalidate()`. A retry on an
    // upload that started with a function must not reach it.
    const configured = { getToken: vi.fn(async () => tokenExpiringIn(3600)), invalidate: vi.fn() };
    const fetchToken = vi.fn(async () => tokenExpiringIn(3600));
    const { manager, cfg } = createManager({ authToken: fetchToken });

    const fromFunction = manager.getAuthToken();
    if (!fromFunction || typeof fromFunction !== 'object') throw new Error('expected a provider');
    await fromFunction.getToken();

    cfg.authToken = configured;
    fromFunction.invalidate?.();

    expect(configured.invalidate).not.toHaveBeenCalled();

    // An explicit `invalidateAuthToken()` still reaches it.
    manager.invalidate();
    expect(configured.invalidate).toHaveBeenCalledTimes(1);
  });

  it('returns undefined once authToken is unset, so no request is signed', () => {
    const { manager, cfg } = createManager({ authToken: vi.fn(async () => tokenExpiringIn(3600)) });
    expect(typeof manager.getAuthToken()).toBe('object');

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

    await resolverOf(manager)();
    manager.invalidate();
    await resolverOf(manager)();

    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it('hands upload-client a provider, so a refused token can be dropped', async () => {
    const fetchToken = vi.fn(() => tokenExpiringIn(3600));
    const { manager } = createManager({ authToken: fetchToken });

    const provider = manager.getAuthToken();
    if (!provider || typeof provider !== 'object') throw new Error('expected a provider');

    await provider.getToken();
    // What upload-client calls when the Upload API refuses the token, e.g.
    // once its operation limit is spent.
    provider.invalidate?.();
    await provider.getToken();

    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it('passes a configured provider through, rather than caching it twice', async () => {
    // Someone bringing their own cache already decides when a token is stale.
    const getToken = vi.fn(async () => tokenExpiringIn(3600));
    const invalidate = vi.fn();
    const { manager } = createManager({ authToken: { getToken, invalidate } });

    expect(manager.getAuthToken()).toEqual({ getToken, invalidate });

    manager.invalidate();
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});
