import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { type CustomConfigDefinition, CustomConfigRegistry } from '../../abstract/customConfigOptions';
import { PluginManagerBridge } from '../../abstract/di/PluginManagerBridge';
import { CTX_BADGE_STYLE, SCOPE_BADGE_STYLE, UC_BADGE_STYLE } from '../../abstract/logger';
import type { PluginController } from '../../abstract/managers/plugin';
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
    // `static uses` + `this.use()`. (The plugin-manager reads stay on the
    // editor-safe `PluginManagerBridge`, unaffected.)
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

  it('writes an attribute change (attributeChangedCallback) into that controller', async () => {
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
  // custom path) routes through the PLUGIN MANAGER's `configRegistry` (the v1 `bag`
  // path, no DI token) rather than `ConfigController.register`, so exercising it
  // needs the full plugin-manager machinery. It is covered end-to-end by
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

      // Drive the change-log via an EXTERNAL config write rather than the element
      // setter: the setter's debug-gated `_assertSameValueDifferentReference`
      // would itself `JSON.stringify` the circular value and throw before the
      // log observer ever runs.
      //
      // Circular object → JSON.stringify throws, String() still works.
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
  });

  it('short-circuits attributeChangedCallback when the value is unchanged', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    const el = await mount(ctxName);

    el.setAttribute('multiple', 'false');
    await delay(0);
    // Set the SAME value again — attributeChangedCallback's `oldVal === newVal`
    // guard returns early.
    el.setAttribute('multiple', 'false');
    await delay(0);

    expect(config.get('multiple')).toBe(false);
  });
});

/**
 * Minimal fake plugin manager bound via the `PluginManagerBridge` token so the
 * custom-config machinery (`_setupCustomConfigs` → `_processCustomConfigs`, the
 * MutationObserver + attributeChangedCallback custom branch) runs in a spec —
 * the same shape `ensurePluginManager` binds (`{ getPluginManager }`), but
 * backed by a real `CustomConfigRegistry` and a tiny `onPluginsChange` emitter.
 */
type FakePluginManager = {
  registry: CustomConfigRegistry;
  emitPluginsChange: () => void;
};

const bindFakePluginManager = (ctxName: string, definitions: CustomConfigDefinition[] = []): FakePluginManager => {
  const container = ensureUploaderCtx(ctxName);
  const config = container.get(ConfigController);
  const registry = new CustomConfigRegistry();
  for (const def of definitions) {
    registry.register('fake-plugin', def);
    // `buildPluginApi`'s `registerConfig` seeds the key on the ConfigController
    // at plugin-setup time; mirror that so `getCustom`/`observeCustom` behave.
    config.register({ name: def.name, defaultValue: def.defaultValue });
  }
  const listeners = new Set<() => void>();
  const manager = {
    configRegistry: registry,
    onPluginsChange: (cb: () => void): (() => void) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  } as unknown as PluginController;
  container.bind(PluginManagerBridge, () => ({ getPluginManager: () => manager }));
  // Eagerly resolve so a `whenController(PluginManagerBridge, cb)` waiter the
  // block registers in `controllerReady` fires synchronously.
  container.get(PluginManagerBridge);
  return {
    registry,
    emitPluginsChange: () => {
      for (const cb of [...listeners]) cb();
    },
  };
};

describe('Config (<uc-config>) — additive coverage: custom configs (fake plugin manager)', () => {
  it('maps kebab/lowercase attrs, deserializes a pre-existing attribute via fromAttribute, and reflects', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    bindFakePluginManager(ctxName, [{ name: 'myOption', defaultValue: 'def', fromAttribute: (v) => `parsed:${v}` }]);

    // Pre-mount kebab-case attribute — read + deserialized on adoption.
    const el = await mount(ctxName, { 'my-option': 'hello' });

    expect((el as unknown as Record<string, unknown>).myOption).toBe('parsed:hello');
    expect(config.getCustom('myOption')).toBe('parsed:hello');
    // Reflected back to both attribute spellings.
    expect(el.getAttribute('my-option')).toBe('parsed:hello');
    expect(el.getAttribute('myoption')).toBe('parsed:hello');
  });

  it('uses the raw attribute value for a custom config without fromAttribute (pre-existing and dynamic)', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    bindFakePluginManager(ctxName, [{ name: 'plainOpt', defaultValue: '' }]);

    // Pre-existing attribute, no fromAttribute → raw string used.
    const el = await mount(ctxName, { 'plain-opt': 'hi' });
    expect(config.getCustom('plainOpt')).toBe('hi');

    // Dynamic attribute change, no fromAttribute → raw string used.
    el.setAttribute('plain-opt', 'bye');
    await delay(0);
    await delay(0);
    expect(config.getCustom('plainOpt')).toBe('bye');
  });

  it('falls back to the raw attribute value and warns when a pre-existing fromAttribute() throws', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    bindFakePluginManager(ctxName, [
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
    expect(config.getCustom('badFrom')).toBe('raw');
    expect((el as unknown as Record<string, unknown>).badFrom).toBe('raw');
    expect(stringArgs(warn).some((s) => s.includes('threw an error, using raw attribute value'))).toBe(true);
  });

  it('reflects an external setCustom back onto the element via observeCustom', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    bindFakePluginManager(ctxName, [{ name: 'myOption', defaultValue: 'def' }]);
    const el = await mount(ctxName);

    config.setCustom('myOption', 'external');
    await delay(0);

    expect((el as unknown as Record<string, unknown>).myOption).toBe('external');
  });

  it('skips attribute reflection for a custom config declared attribute: false', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    bindFakePluginManager(ctxName, [{ name: 'noAttr', defaultValue: 'x', attribute: false }]);
    const el = await mount(ctxName);

    (el as unknown as Record<string, unknown>).noAttr = 'val';

    expect(config.getCustom('noAttr')).toBe('val');
    expect(el.hasAttribute('no-attr')).toBe(false);
    expect(el.hasAttribute('noattr')).toBe(false);
  });

  it('keeps the previous value and warns when a custom normalize() throws', async () => {
    const ctxName = freshCtxName();
    bindFakePluginManager(ctxName, [
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
    bindFakePluginManager(ctxName, [{ name: 'myOption', defaultValue: undefined }]);
    const el = await mount(ctxName);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    config.set('debug', true);
    (el as unknown as Record<string, unknown>).myOption = 'value';
    await delay(0);
    (el as unknown as Record<string, unknown>).myOption = undefined;
    await delay(0);

    expect(stringArgs(log).some((s) => s.includes('myOption: "value" → undefined'))).toBe(true);
  });

  it('re-processes custom configs and cleans up removed subscriptions on plugin change', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    const pm = bindFakePluginManager(ctxName, [
      { name: 'first', defaultValue: 'a' },
      { name: 'second', defaultValue: 'b' },
    ]);
    const el = await mount(ctxName);

    // Register a NEW config and unregister an existing one, then fire the change.
    pm.registry.register('fake-plugin', { name: 'third', defaultValue: 'c' });
    config.register({ name: 'third', defaultValue: 'c' });
    pm.registry.unregister('second');
    pm.emitPluginsChange();
    await delay(0);

    // The freshly-registered key now has a working accessor.
    (el as unknown as Record<string, unknown>).third = 'z';
    expect(config.getCustom('third')).toBe('z');
  });

  it('seeds a pre-existing data property set before adoption', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    bindFakePluginManager(ctxName, [{ name: 'preSet', defaultValue: 'def' }]);

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
    expect(config.getCustom('preSet')).toBe('early');
  });

  it('forwards a dynamically-set custom attribute through the MutationObserver + attributeChangedCallback', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    bindFakePluginManager(ctxName, [
      { name: 'liveOpt', defaultValue: '', fromAttribute: (v) => (v ?? '').toUpperCase() },
    ]);
    const el = await mount(ctxName);

    // Not a statically-observed attribute → handled by the MutationObserver,
    // which routes into the custom branch of attributeChangedCallback.
    el.setAttribute('live-opt', 'boom');
    await delay(0);
    await delay(0);

    expect(config.getCustom('liveOpt')).toBe('BOOM');

    // Setting the SAME value exercises the observer's `oldValue === newValue`
    // skip.
    el.setAttribute('live-opt', 'BOOM');
    await delay(0);

    expect(config.getCustom('liveOpt')).toBe('BOOM');
  });

  it('ignores a stale custom attributeChangedCallback whose value the attribute already moved past', async () => {
    const ctxName = freshCtxName();
    const config = controllerFor(ctxName);
    bindFakePluginManager(ctxName, [{ name: 'liveOpt', defaultValue: 'init' }]);
    const el = await mount(ctxName);

    el.setAttribute('live-opt', 'current');
    await delay(0);
    expect(config.getCustom('liveOpt')).toBe('current');

    // The DOM attribute is 'current'; a callback carrying an older value is
    // stale and must bail without writing.
    el.attributeChangedCallback('live-opt', 'current', 'stale');
    await delay(0);

    expect(config.getCustom('liveOpt')).toBe('current');
  });
});
