import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { delay } from '../../utils/delay';
import { DropArea } from './DropArea';

// Idempotent (same path as defineComponents(UC)).
DropArea.reg('uc-drop-area');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `drop-area-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    UploaderRegistry.dispose(name);
  }
});

const mount = async (ctxName: string): Promise<{ el: DropArea; config: ConfigController }> => {
  ensureUploaderCtx(ctxName);
  const config = UploaderRegistry.get(ctxName)?.get(ConfigController);
  if (!config) throw new Error('config controller not resolved');
  const el = document.createElement('uc-drop-area') as DropArea;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return { el, config };
};

describe('DropArea', () => {
  it('attaches the uploader scope and renders into its own light DOM', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    expect(el.shadowRoot).toBeNull();
    // The scope-attach role is preserved: adopting a controller bootstraps the
    // ctx and the block renders its content wrapper.
    expect(el.querySelector('.uc-content-wrapper')).not.toBeNull();
  });

  it('hides the drop area when the sourceList config drops local (config read via the same ConfigController)', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mount(ctxName);
    // Default sourceList allows local uploads -> visible.
    expect(el.hidden).toBe(false);

    config.set('sourceList', 'url');
    await el.updateComplete;
    await delay(0);
    expect(el.hidden).toBe(true);

    config.set('sourceList', 'local, url');
    await el.updateComplete;
    await delay(0);
    expect(el.hidden).toBe(false);
  });

  it('exposes a clickable drop area as a focusable button, and only while clickable and enabled', async () => {
    const { el } = await mount(freshCtxName());
    expect(el.hasAttribute('role')).toBe(false);
    expect(el.hasAttribute('tabindex')).toBe(false);

    el.clickable = true;
    await el.updateComplete;
    expect(el.getAttribute('role')).toBe('button');
    expect(el.getAttribute('tabindex')).toBe('0');

    el.disabled = true;
    await el.updateComplete;
    expect(el.hasAttribute('role')).toBe(false);
    expect(el.hasAttribute('tabindex')).toBe(false);

    el.disabled = false;
    await el.updateComplete;
    expect(el.getAttribute('role')).toBe('button');

    el.clickable = false;
    await el.updateComplete;
    expect(el.hasAttribute('role')).toBe(false);
    expect(el.hasAttribute('tabindex')).toBe(false);
  });

  it('opens the dialog on Enter, NumpadEnter and Space, and keeps Space from scrolling the page', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    el.clickable = true;
    await el.updateComplete;
    const api = UploaderRegistry.get(ctxName)?.get(UploaderPublicApi);
    if (!api) throw new Error('api not resolved');
    const open = vi.spyOn(api, 'openSystemDialog').mockImplementation(() => {});

    const press = (init: KeyboardEventInit): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
      el.dispatchEvent(event);
      return event;
    };

    press({ key: 'Enter', code: 'Enter' });
    press({ key: 'Enter', code: 'NumpadEnter' });
    const space = press({ key: ' ', code: 'Space' });
    press({ key: 'a', code: 'KeyA' });

    expect(open).toHaveBeenCalledTimes(3);
    expect(space.defaultPrevented).toBe(true);
  });

  it('reads a "false" flag attribute as off and drops it, so the [flag] styles do not apply either', async () => {
    const { el } = await mount(freshCtxName());
    el.setAttribute('clickable', 'false');
    el.setAttribute('with-icon', 'false');
    el.setAttribute('disabled', 'false');
    el.setAttribute('ghost', 'false');
    await el.updateComplete;

    expect(el.clickable).toBe(false);
    expect(el.withIcon).toBe(false);
    expect(el.disabled).toBe(false);
    for (const name of ['clickable', 'with-icon', 'disabled', 'ghost']) {
      expect(el.hasAttribute(name)).toBe(false);
    }

    el.setAttribute('fullscreen', 'true');
    await el.updateComplete;
    expect(el.fullscreen).toBe(true);
    expect(el.hasAttribute('fullscreen')).toBe(true);
  });
});
