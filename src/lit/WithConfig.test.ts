import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../abstract/controllers/ConfigController';
import { UploaderRegistry } from '../abstract/UploaderRegistry';
import { delay } from '../utils/delay';
import { ChildBlock } from './ChildBlock';
import { ensureUploaderCtx } from './ensureUploaderCtx';
import { WithConfig } from './WithConfig';

// A config host on a plain ChildBlock (NOT <uc-config>) — proves the capability
// is block-agnostic. Idempotent registration.
class ConfigHostProbe extends WithConfig(ChildBlock) {}
ConfigHostProbe.reg('uc-config-host-probe');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `withconfig-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) UploaderRegistry.dispose(name);
  vi.restoreAllMocks();
});

const mount = async (ctxName: string): Promise<ConfigHostProbe> => {
  ensureUploaderCtx(ctxName);
  const el = document.createElement('uc-config-host-probe') as ConfigHostProbe;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  await delay(0);
  return el;
};

/** True if any console.warn call carried the given substring. */
const warnedWith = (warn: ReturnType<typeof vi.spyOn>, substr: string): boolean =>
  warn.mock.calls.some((call: unknown[]) =>
    call.some((arg: unknown) => typeof arg === 'string' && arg.includes(substr)),
  );

describe('WithConfig (block-agnostic config host)', () => {
  it('does not claim config keys on observedAttributes (leaves Lit free for subclasses)', () => {
    // Config attrs use setAttribute overrides + MO backup, not CE observedAttributes —
    // so a subclass `@property({ attribute: 'mode' })` keeps working.
    expect(ConfigHostProbe.observedAttributes ?? []).not.toContain('multiple');
    expect(ConfigHostProbe.observedAttributes ?? []).not.toContain('pubkey');
  });

  it('applies a built-in config attribute synchronously via setAttribute (no MO wait)', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);
    el.setAttribute('pubkey', 'from-attr');
    // Must be immediate — integrations call api right after setAttribute.
    const config = UploaderRegistry.get(ctxName)?.get(ConfigController);
    expect(config?.get('pubkey')).toBe('from-attr');
    expect(el.pubkey).toBe('from-attr');
  });

  it('makes a pre-connect setAttribute readable as a DOM property before adoption', () => {
    const el = document.createElement('uc-config-host-probe') as ConfigHostProbe;
    mounted.push(el);
    el.setAttribute('pubkey', 'pre-connect-key');
    // No controller yet — same contract as historical attributeChangedCallback stash.
    expect(el.pubkey).toBe('pre-connect-key');
  });

  it('seeds a pre-connect attribute into the controller once connected', async () => {
    const ctxName = freshCtxName();
    const el = document.createElement('uc-config-host-probe') as ConfigHostProbe;
    el.setAttribute('pubkey', 'pre-connect-key');
    el.setAttribute('ctx-name', ctxName);
    ensureUploaderCtx(ctxName);
    document.body.append(el);
    mounted.push(el);
    await el.updateComplete;
    await delay(0);
    const config = UploaderRegistry.get(ctxName)?.get(ConfigController);
    expect(config?.get('pubkey')).toBe('pre-connect-key');
    expect(el.pubkey).toBe('pre-connect-key');
  });

  it('does not throw on setAttribute while detached after adoption (accessors installed)', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);
    // Accessors installed; releasing the container leaves them in place.
    el.remove();
    expect(() => el.setAttribute('pubkey', 'while-detached')).not.toThrow();
    // Live attr remains for seed on re-adoption (no Reflect.set through setter).
    expect(el.getAttribute('pubkey')).toBe('while-detached');

    const ctxName2 = freshCtxName();
    el.setAttribute('ctx-name', ctxName2);
    ensureUploaderCtx(ctxName2);
    document.body.append(el);
    mounted.push(el);
    await el.updateComplete;
    await delay(0);
    const config = UploaderRegistry.get(ctxName2)?.get(ConfigController);
    expect(config?.get('pubkey')).toBe('while-detached');
    expect(el.pubkey).toBe('while-detached');
  });

  it('applies source-list synchronously so a following read sees the new value', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);
    el.setAttribute('source-list', 'dropbox');
    const config = UploaderRegistry.get(ctxName)?.get(ConfigController);
    expect(config?.get('sourceList')).toBe('dropbox');
  });

  it('applies kebab-case and full-lowercase config attrs synchronously (not only camelCase)', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);
    const config = UploaderRegistry.get(ctxName)?.get(ConfigController);

    // Kebab (HTML/docs style)
    el.setAttribute('source-list', 'dropbox');
    expect(config?.get('sourceList')).toBe('dropbox');

    // Full lowercase (Vue/React attr folding / setAttribute name normalization)
    el.setAttribute('sourcelist', 'url');
    expect(config?.get('sourceList')).toBe('url');

    // CamelCase input: HTML lowercases the name; sync path must follow
    el.setAttribute('sourceList', 'local');
    expect(el.getAttribute('sourcelist')).toBe('local');
    expect(config?.get('sourceList')).toBe('local');
  });

  it('applies custom config attrs in kebab and lowercase forms synchronously', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);
    const config = UploaderRegistry.get(ctxName)?.get(ConfigController);
    config?.register({ name: 'myPluginOpt', defaultValue: '', attribute: true });
    await delay(0);

    el.setAttribute('my-plugin-opt', 'kebab');
    expect(config?.get('myPluginOpt')).toBe('kebab');

    el.setAttribute('mypluginopt', 'lower');
    expect(config?.get('myPluginOpt')).toBe('lower');

    el.setAttribute('myPluginOpt', 'camel');
    expect(config?.get('myPluginOpt')).toBe('camel');
  });

  it('writes a config property into the ctx ConfigController from a non-<uc-config> host', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);
    el.pubkey = 'fromprobe';
    const config = UploaderRegistry.get(ctxName)?.get(ConfigController);
    expect(config?.get('pubkey')).toBe('fromprobe');
  });

  it('does not throw in debug mode when comparing circular values', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);
    el.debug = true;

    const previous = { kind: 'metadata' } as { kind: string; self?: unknown };
    previous.self = previous;
    const next = { kind: 'metadata' } as { kind: string; self?: unknown };
    next.self = next;

    expect(() => {
      Reflect.set(el, 'metadata', previous);
      Reflect.set(el, 'metadata', next);
    }).not.toThrow();
  });

  it('clears custom attribute mapping on release', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);
    const config = UploaderRegistry.get(ctxName)?.get(ConfigController);
    config?.register({ name: 'pluginOption', defaultValue: '', attribute: true });
    await delay(0);

    const mappingBefore = Reflect.get(el, '_customAttrKeyMapping') as Record<string, string>;
    expect(mappingBefore['plugin-option']).toBe('pluginOption');

    el.remove();

    const mappingAfter = Reflect.get(el, '_customAttrKeyMapping') as Record<string, string>;
    expect(mappingAfter).toEqual({});
  });

  describe('one-config-host-per-ctx warning (Policy 2, deferred confirm)', () => {
    it('warns (deferred, once) when two config hosts share a ctx', async () => {
      const ctxName = freshCtxName();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await mount(ctxName);
      await mount(ctxName); // second host on the SAME ctx
      await delay(0); // let the deferred microtask re-check run

      expect(warnedWith(warn, 'multiple config writers')).toBe(true);
      expect(warnedWith(warn, ctxName)).toBe(true);
    });

    it('does not warn when a single host is swapped (old deregisters before the tick)', async () => {
      const ctxName = freshCtxName();
      const first = await mount(ctxName);
      first.remove(); // disconnected → controllerReleased → unregisterWriter (sync)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await mount(ctxName); // replacement host
      await delay(0);

      expect(warnedWith(warn, 'multiple config writers')).toBe(false);
    });
  });
});
