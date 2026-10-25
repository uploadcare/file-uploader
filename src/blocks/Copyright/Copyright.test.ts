import { afterEach, describe, expect, it } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { delay } from '../../utils/delay';
import { Copyright } from './Copyright';

// Idempotent (same path as defineComponents(UC)).
Copyright.reg('uc-copyright');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `copyright-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    UploaderRegistry.dispose(name);
  }
});

const mount = async (ctxName: string): Promise<Copyright> => {
  const el = document.createElement('uc-copyright') as Copyright;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return el;
};

const link = (el: HTMLElement): HTMLAnchorElement | null => el.querySelector<HTMLAnchorElement>('.uc-credits');

describe('Copyright', () => {
  it('renders the credits link into its own light DOM (no shadow root)', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    // LightDomMixin renders into the host itself, not a shadow root.
    expect(el.shadowRoot).toBeNull();
    const a = link(el);
    expect(a).not.toBeNull();
    expect(a?.textContent?.trim()).toBe('Powered by Uploadcare');
    // The inner <a> never carries `hidden` — visibility is driven from the host
    // (see below), which the inline solution's `:has(uc-copyright[hidden])` CSS
    // keys off.
    expect(a?.hasAttribute('hidden')).toBe(false);
    expect(el.hasAttribute('hidden')).toBe(false);
  });

  it('toggles [hidden] on the HOST (not the inner <a>) when the external config signal changes', async () => {
    const ctxName = freshCtxName();
    // Force the ctx/container/controller into existence so we can drive config
    // through the SAME ConfigController instance the block resolves via use().
    ensureUploaderCtx(ctxName);
    const config = UploaderRegistry.get(ctxName)?.get(ConfigController);
    expect(config).toBeDefined();

    const el = await mount(ctxName);
    expect(el.hasAttribute('hidden')).toBe(false);
    // The <a> must never receive `hidden` — the host owns that state so the
    // inline `:has(uc-copyright[hidden])` selector matches.
    expect(link(el)?.hasAttribute('hidden')).toBe(false);

    // External config change — no imperative wiring on the block. SignalWatcher
    // tracked the `removeCopyright` read during willUpdate(), so this re-runs the
    // update and re-toggles the host attribute.
    config?.set('removeCopyright', true);
    await el.updateComplete;
    await delay(0);
    expect(el.hasAttribute('hidden')).toBe(true);
    expect(link(el)?.hasAttribute('hidden')).toBe(false);

    config?.set('removeCopyright', false);
    await el.updateComplete;
    await delay(0);
    expect(el.hasAttribute('hidden')).toBe(false);
    expect(link(el)?.hasAttribute('hidden')).toBe(false);
  });

  it('opens the credits link in a new browsing context without an opener', async () => {
    const el = await mount(freshCtxName());
    const a = link(el);
    // `target` is a single browsing-context name: `_blank noopener` would be a
    // named, reused window that keeps `window.opener`.
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.relList.contains('noopener')).toBe(true);
    expect(a?.relList.contains('noreferrer')).toBe(true);
  });
});
