import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import type { CustomConfigDefinition } from '../../abstract/customConfigOptions';
import { CTX_BADGE_STYLE, SCOPE_BADGE_STYLE, UC_BADGE_STYLE } from '../../abstract/logger';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { delay } from '../../utils/delay';
import { Config } from './Config';

// Idempotent (same path as defineComponents(UC)).
Config.reg('uc-config');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `config-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    UploaderRegistry.dispose(name);
  }
  // Restore the console spies the change-log tests install — otherwise
  // `vi.spyOn(console, 'log')` returns the same persistent mock and its
  // `.mock.calls` accumulate across tests, breaking the debug-off assertion.
  vi.restoreAllMocks();
});

const track = (el: HTMLElement): void => {
  mounted.push(el);
};

/** The SAME ConfigController the rest of the app reads (v1 `this.uploader.config`). */
const controllerFor = (ctxName: string): ConfigController => {
  ensureUploaderCtx(ctxName);
  const container = UploaderRegistry.get(ctxName);
  if (!container) throw new Error('no container');
  return container.get(ConfigController);
};

const mount = async (ctxName: string, attrs: Record<string, string> = {}): Promise<Config> => {
  const el = document.createElement('uc-config') as Config;
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  track(el);
  await el.updateComplete;
  await delay(0);
  return el;
};

describe('Config (<uc-config>) — M-god step 6b-5 use(ConfigController)', () => {
  it('resolves its ConfigController dependency via the @inject field on the element', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    const el = await mount(ctxName);
    // The `@inject(ConfigController)` field resolves through the container the
    // block adopted (tagged as `this[CONTAINER]`), yielding the very same
    // controller instance the ctx owns — the mechanism that replaces
    // `static uses` + `this.use()`.
    expect((el as unknown as { _config: ConfigController })._config).toBe(config);
  });

  it('writes a DOM-property value into the SAME ConfigController the app reads', async () => {
    const ctxName = freshCtxName();
    // Force ctx/container/controller into existence up front so we compare
    // against the exact instance the block resolves via use().
    const config = controllerFor(ctxName);

    const el = await mount(ctxName);
    el.pubkey = 'demopublickey';

    expect(config.get('pubkey')).toBe('demopublickey');
    // Round-trips back through the element getter (which reads the same controller).
    expect(el.pubkey).toBe('demopublickey');
  });

  it('writes an attribute change (MutationObserver) into that controller', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);

    const el = await mount(ctxName);
    el.setAttribute('multiple', 'false');
    await delay(0);

    expect(config.get('multiple')).toBe(false);
  });

  it('flushes an initial pre-mount attribute value into the controller', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);

    await mount(ctxName, { pubkey: 'seededkey' });

    expect(config.get('pubkey')).toBe('seededkey');
  });

  it('reflects an external controller change back onto the element (subscribe path)', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);

    const el = await mount(ctxName);
    // External write on the SAME controller — the block's config subscription
    // must pull it back onto the local property (and DOM attribute).
    config.set('pubkey', 'externallyset');
    await el.updateComplete;
    await delay(0);

    expect(el.pubkey).toBe('externallyset');
    expect(el.getAttribute('pubkey')).toBe('externallyset');
  });

  describe('change log (_setupChangeLog, verbose/debug-gated)', () => {
    // Header the ChildBlock logger emits for `<uc-config>`: uc + this ctx-name +
    // the `config` scope (tag minus the `uc-` prefix), then the reset chip.
    const header = (ctxName: string) => `%c uc %c ${ctxName} %c config %c`;

    it('logs a value change as `key: <old> → <new>`, quoting strings (empty string as "")', async () => {
      const ctxName = freshCtxName();
      const config = controllerFor(ctxName);
      const el = await mount(ctxName);
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});

      config.set('debug', true); // turn the verbose gate on
      el.pubkey = 'demopublickey'; // '' → 'demopublickey' — empty old value shows as ""
      await delay(0);

      expect(log).toHaveBeenCalledWith(
        header(ctxName),
        UC_BADGE_STYLE,
        CTX_BADGE_STYLE,
        SCOPE_BADGE_STYLE,
        '',
        'pubkey: "" → "demopublickey"',
      );
    });

    it('logs a boolean change (debug: false → true)', async () => {
      const ctxName = freshCtxName();
      const config = controllerFor(ctxName);
      await mount(ctxName);
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});

      config.set('debug', true);
      await delay(0);

      expect(log).toHaveBeenCalledWith(
        header(ctxName),
        UC_BADGE_STYLE,
        CTX_BADGE_STYLE,
        SCOPE_BADGE_STYLE,
        '',
        'debug: false → true',
      );
    });

    it('does not log config changes when debug is off', async () => {
      const ctxName = freshCtxName();
      const el = await mount(ctxName);
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});

      el.pubkey = 'demopublickey';
      await delay(0);

      expect(log).not.toHaveBeenCalled();
    });
  });

  // The custom-config attribute bridge (MutationObserver + attributeChangedCallback
  // custom path) is now descriptor-driven off `ConfigController` — no plugin
  // manager involved — so it's exercised directly in the additive coverage block
  // below via `registerCustomConfigs`, and end-to-end by
  // `tests/plugins/custom-config.e2e.test.tsx`.
});

/** Flatten a console spy's calls down to just their string arguments. */
const stringArgs = (spy: { mock: { calls: unknown[][] } }): string[] =>
  spy.mock.calls.flatMap((call) => call.filter((a): a is string => typeof a === 'string'));

describe('Config (<uc-config>) — additive coverage: plain/complex keys, reflect, computed, debug', () => {
  it('accepts a complex key (metadata) into the controller WITHOUT reflecting an attribute', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    const el = await mount(ctxName);

    const value = { a: '1', b: '2' };
    el.metadata = value;

    expect(config.get('metadata')).toEqual(value);
    // Complex keys can't be represented as attributes — nothing reflected.
    expect(el.hasAttribute('metadata')).toBe(false);
  });

  it('removes the reflected attribute and resets to default when a plain key is set to undefined', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    const el = await mount(ctxName);

    // `defaultCameraMode` has a `null` default, so resetting it removes the
    // attribute outright (an empty-string default would reflect back as `attr=""`).
    el.defaultCameraMode = 'video';
    expect(el.getAttribute('default-camera-mode')).toBe('video');

    el.defaultCameraMode = undefined as unknown as null;

    expect(el.hasAttribute('default-camera-mode')).toBe(false);
    expect(el.hasAttribute('defaultcameramode')).toBe(false);
    expect(config.get('defaultCameraMode')).toBe(null);
  });

  it('warns (debug on) when a complex value is deep-equal but a different reference', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    const el = await mount(ctxName);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    config.set('debug', true);
    el.metadata = { a: '1' };
    // Deep-equal, but a fresh object reference.
    el.metadata = { a: '1' };

    expect(stringArgs(warn).some((s) => s.includes('the reference is different'))).toBe(true);
  });

  it('recomputes cameraModes from enableVideoRecording (computed property strips video)', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    const el = await mount(ctxName);

    el.enableVideoRecording = false;
    await delay(0);
    expect(config.get('cameraModes')).toBe('photo');
  });

  it('recomputes cameraModes from defaultCameraMode (computed property reorders CSV)', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    const el = await mount(ctxName);

    el.defaultCameraMode = 'video';
    await delay(0);
    expect(config.get('cameraModes')).toBe('video,photo');
  });

  describe('change log (_setupChangeLog) — formatConfigLogValue edge cases', () => {
    it('renders a function value as `ƒ`', async () => {
      const ctxName = freshCtxName();
      const config = controllerFor(ctxName);
      const el = await mount(ctxName);
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});

      config.set('debug', true);
      el.secureUploadsSignatureResolver = () => Promise.resolve(null);
      await delay(0);

      expect(stringArgs(log).some((s) => s.includes('secureUploadsSignatureResolver: null → ƒ'))).toBe(true);
    });

    it('falls back to String()/[unserializable] when JSON.stringify throws', async () => {
      const ctxName = freshCtxName();
      const config = controllerFor(ctxName);
      await mount(ctxName);
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});

      config.set('debug', true);

      // Circular object → JSON.stringify throws, String() still works.
      // External write: change-log uses guarded formatConfigLogValue.
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      config.set('mediaRecorderOptions', circular as unknown as MediaRecorderOptions);
      await delay(0);

      // Circular AND a throwing toString → both JSON.stringify and String() throw.
      const unserializable: Record<string, unknown> = {
        toString: () => {
          throw new Error('nope');
        },
      };
      unserializable.self = unserializable;
      config.set('mediaRecorderOptions', unserializable as unknown as MediaRecorderOptions);
      await delay(0);

      const logged = stringArgs(log);
      expect(logged.some((s) => s.includes('[object Object]'))).toBe(true);
      expect(logged.some((s) => s.includes('[unserializable]'))).toBe(true);
    });

    it('does not throw from the element setter when debug-asserting a circular complex value', async () => {
      const ctxName = freshCtxName();
      const config = controllerFor(ctxName);
      const el = await mount(ctxName);
      config.set('debug', true);

      const circular: Record<string, unknown> = {};
      circular.self = circular;

      // `_assertSameValueDifferentReference` must swallow JSON.stringify throws
      // so a debug-only warning never blocks the write.
      expect(() => {
        el.mediaRecorderOptions = circular as unknown as MediaRecorderOptions;
      }).not.toThrow();
      expect(el.mediaRecorderOptions).toBe(circular);
    });
  });

  it('short-circuits MutationObserver when the attribute value is unchanged', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    const el = await mount(ctxName);

    el.setAttribute('multiple', 'false');
    await delay(0);
    // Set the SAME value again — MO's oldValue === getAttribute skip is a no-op.
    el.setAttribute('multiple', 'false');
    await delay(0);

    expect(config.get('multiple')).toBe(false);
  });
});

/**
 * Register custom config descriptors on the ctx's `ConfigController` — exactly
 * what a plugin's `registerConfig` does now (the controller is the single source
 * of truth for config descriptors; there is no separate plugin config registry).
 * Registering with `owner = name` lets a single key be dropped via
 * `unregisterByOwner` in dynamic tests. Returns the `ConfigController` so tests
 * can register/unregister more keys and observe the schema-change re-sync.
 */
const registerCustomConfigs = (ctxName: string, definitions: CustomConfigDefinition[] = []): ConfigController => {
  const config = controllerFor(ctxName);
  for (const def of definitions) {
    config.register(def, def.name);
  }
  return config;
};

describe('Config (<uc-config>) — additive coverage: custom configs (fake plugin manager)', () => {
  it('maps kebab/lowercase attrs, deserializes a pre-existing attribute via fromAttribute, and reflects', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    registerCustomConfigs(ctxName, [{ name: 'myOption', defaultValue: 'def', fromAttribute: (v) => `parsed:${v}` }]);

    // Pre-mount kebab-case attribute — read + deserialized on adoption.
    const el = await mount(ctxName, { 'my-option': 'hello' });

    expect((el as unknown as Record<string, unknown>).myOption).toBe('parsed:hello');
    expect(config.get('myOption')).toBe('parsed:hello');
    // Reflected back to both attribute spellings.
    expect(el.getAttribute('my-option')).toBe('parsed:hello');
    expect(el.getAttribute('myoption')).toBe('parsed:hello');
  });

  it('uses the raw attribute value for a custom config without fromAttribute (pre-existing and dynamic)', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    registerCustomConfigs(ctxName, [{ name: 'plainOpt', defaultValue: '' }]);

    // Pre-existing attribute, no fromAttribute → raw string used.
    const el = await mount(ctxName, { 'plain-opt': 'hi' });
    expect(config.get('plainOpt')).toBe('hi');

    // Dynamic attribute change, no fromAttribute → raw string used.
    el.setAttribute('plain-opt', 'bye');
    await delay(0);
    await delay(0);
    expect(config.get('plainOpt')).toBe('bye');
  });

  it('falls back to the raw attribute value and warns when a pre-existing fromAttribute() throws', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    registerCustomConfigs(ctxName, [
      {
        name: 'badFrom',
        defaultValue: '',
        fromAttribute: () => {
          throw new Error('bad parse');
        },
      },
    ]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const el = await mount(ctxName, { 'bad-from': 'raw' });

    // fromAttribute threw during pre-existing-attribute read → raw value kept.
    expect(config.get('badFrom')).toBe('raw');
    expect((el as unknown as Record<string, unknown>).badFrom).toBe('raw');
    expect(stringArgs(warn).some((s) => s.includes('threw an error, using raw attribute value'))).toBe(true);
  });

  it('reflects an external set() of a custom key back onto the element via observe', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    registerCustomConfigs(ctxName, [{ name: 'myOption', defaultValue: 'def' }]);
    const el = await mount(ctxName);

    config.set('myOption', 'external');
    await delay(0);

    expect((el as unknown as Record<string, unknown>).myOption).toBe('external');
  });

  it('skips attribute reflection for a custom config declared attribute: false', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    registerCustomConfigs(ctxName, [{ name: 'noAttr', defaultValue: 'x', attribute: false }]);
    const el = await mount(ctxName);

    (el as unknown as Record<string, unknown>).noAttr = 'val';

    expect(config.get('noAttr')).toBe('val');
    expect(el.hasAttribute('no-attr')).toBe(false);
    expect(el.hasAttribute('noattr')).toBe(false);
  });

  it('keeps the previous value and warns when a custom normalize() throws', async () => {
    const ctxName = freshCtxName();
    registerCustomConfigs(ctxName, [
      {
        name: 'strictOpt',
        defaultValue: 0,
        normalize: (v) => {
          if (typeof v !== 'number') throw new Error('not a number');
          return v;
        },
      },
    ]);
    const el = await mount(ctxName);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    (el as unknown as Record<string, unknown>).strictOpt = 5;
    expect((el as unknown as Record<string, unknown>).strictOpt).toBe(5);

    (el as unknown as Record<string, unknown>).strictOpt = 'nope';

    // Previous value retained; a warning was logged.
    expect((el as unknown as Record<string, unknown>).strictOpt).toBe(5);
    expect(stringArgs(warn).some((s) => s.includes('threw an error, keeping previous value'))).toBe(true);
  });

  it('logs a custom value transitioning to undefined (formatConfigLogValue undefined branch)', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    registerCustomConfigs(ctxName, [{ name: 'myOption', defaultValue: undefined }]);
    const el = await mount(ctxName);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    config.set('debug', true);
    (el as unknown as Record<string, unknown>).myOption = 'value';
    await delay(0);
    (el as unknown as Record<string, unknown>).myOption = undefined;
    await delay(0);

    expect(stringArgs(log).some((s) => s.includes('myOption: "value" → undefined'))).toBe(true);
  });

  it('re-syncs custom configs and cleans up removed subscriptions on a schema change', async () => {
    const ctxName = freshCtxName();
    const config = registerCustomConfigs(ctxName, [
      { name: 'first', defaultValue: 'a' },
      { name: 'second', defaultValue: 'b' },
    ]);
    const el = await mount(ctxName);

    // Register a NEW descriptor and drop an existing one — each fires the
    // controller's schema-change signal, which re-runs the host's _syncCustomConfigs.
    config.register({ name: 'third', defaultValue: 'c' }, 'third');
    config.unregisterByOwner('second');
    await delay(0);

    // The freshly-registered key now has a working accessor.
    (el as unknown as Record<string, unknown>).third = 'z';
    expect(config.get('third')).toBe('z');
  });

  it('seeds a pre-existing data property set before adoption', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    registerCustomConfigs(ctxName, [{ name: 'preSet', defaultValue: 'def' }]);

    const el = document.createElement('uc-config') as Config;
    // A data property set before the element adopts a container (e.g. a
    // framework property binding landing before upgrade).
    (el as unknown as Record<string, unknown>).preSet = 'early';
    el.setAttribute('ctx-name', ctxName);
    document.body.append(el);
    track(el);
    await el.updateComplete;
    await delay(0);

    expect((el as unknown as Record<string, unknown>).preSet).toBe('early');
    expect(config.get('preSet')).toBe('early');
  });

  it('forwards a dynamically-set custom attribute through the MutationObserver', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    registerCustomConfigs(ctxName, [
      { name: 'liveOpt', defaultValue: '', fromAttribute: (v) => (v ?? '').toUpperCase() },
    ]);
    const el = await mount(ctxName);

    // Custom attrs are MO-driven (no observedAttributes entry).
    el.setAttribute('live-opt', 'boom');
    await delay(0);
    await delay(0);

    expect(config.get('liveOpt')).toBe('BOOM');

    // Setting the SAME value exercises the observer's no-op when unchanged.
    el.setAttribute('live-opt', 'BOOM');
    await delay(0);

    expect(config.get('liveOpt')).toBe('BOOM');
  });

  it('applies the live DOM attribute value (MO re-reads getAttribute; no stale newVal)', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    registerCustomConfigs(ctxName, [{ name: 'liveOpt', defaultValue: 'init' }]);
    const el = await mount(ctxName);

    el.setAttribute('live-opt', 'current');
    await delay(0);
    expect(config.get('liveOpt')).toBe('current');

    // Handler always re-reads getAttribute — writing the same live value again
    // is a no-op; a superseded mutation cannot clobber a newer attr.
    el.setAttribute('live-opt', 'current');
    await delay(0);
    expect(config.get('liveOpt')).toBe('current');
  });

  it('restores a non-string custom default on attribute removal without feeding it to fromAttribute', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    // fromAttribute accepts string | null (attr contract) — must never receive the
    // bare numeric defaultValue from the removal path.
    const fromAttribute = vi.fn((v: string | null) => Number(v));
    registerCustomConfigs(ctxName, [
      {
        name: 'countOpt',
        defaultValue: 0,
        fromAttribute,
        normalize: (v) => (typeof v === 'number' ? v : Number(v)),
      },
    ]);
    const el = await mount(ctxName);

    el.setAttribute('count-opt', '7');
    await delay(0);
    await delay(0);
    expect(config.get('countOpt')).toBe(7);
    fromAttribute.mockClear();

    el.removeAttribute('count-opt');
    await delay(0);
    await delay(0);

    // Default restored. Reflection may re-write the attr as `"0"` and re-enter
    // fromAttribute with that STRING — never with the raw number `0`.
    expect(config.get('countOpt')).toBe(0);
    expect(fromAttribute.mock.calls.every(([v]) => typeof v === 'string' || v === null)).toBe(true);
  });
});
