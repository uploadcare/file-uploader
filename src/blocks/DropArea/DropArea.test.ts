import { afterEach, describe, expect, it } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { PubSub } from '../../lit/PubSubCompat';
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
    if (PubSub.hasCtx(name)) PubSub.deleteCtx(name);
  }
});

const mount = async (ctxName: string): Promise<{ el: DropArea; config: ConfigController }> => {
  ensureUploaderCtx(ctxName);
  const config = PubSub.getContainer(ctxName)?.get(ConfigController);
  if (!config) throw new Error('config controller not resolved');
  const el = document.createElement('uc-drop-area') as DropArea;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return { el, config };
};

describe('DropArea (M-god step 6b-3 migration)', () => {
  it('declares its dependencies via static uses', () => {
    expect(DropArea.uses).toEqual([ConfigController, RouterController]);
  });

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
});
