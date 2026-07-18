import { afterEach, describe, expect, it } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { PubSub } from '../../lit/PubSubCompat';
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
    if (PubSub.hasCtx(name)) PubSub.deleteCtx(name);
  }
});

const track = (el: HTMLElement): void => {
  mounted.push(el);
};

/** The SAME ConfigController the rest of the app reads (v1 `this.uploader.config`). */
const controllerFor = (ctxName: string): ConfigController => {
  ensureUploaderCtx(ctxName);
  const container = PubSub.getContainer(ctxName);
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
  it('declares its dependency via static uses', () => {
    expect(Config.uses).toEqual([ConfigController]);
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

  // The custom-config attribute bridge (MutationObserver + attributeChangedCallback
  // custom path) routes through the PLUGIN MANAGER's `configRegistry` (the v1 `bag`
  // path, no DI token) rather than `ConfigController.register`, so exercising it
  // needs the full plugin-manager machinery. It is covered end-to-end by
  // `tests/plugins/custom-config.e2e.test.tsx`.
});
