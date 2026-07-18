import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterController } from '../../../abstract/controllers/RouterController';
import { TelemetryManager } from '../../../abstract/managers/TelemetryManager';
import { ensureUploaderCtx } from '../../../lit/ensureUploaderCtx';
import { PubSub } from '../../../lit/PubSubCompat';
import { delay } from '../../../utils/delay';
import { FileUploaderRegular } from './FileUploaderRegular';

// Idempotent (same path as defineComponents(UC)).
FileUploaderRegular.reg('uc-file-uploader-regular');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `fu-regular-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    if (PubSub.hasCtx(name)) PubSub.deleteCtx(name);
  }
});

const mount = async (
  ctxName: string,
  attrs: Record<string, string> = {},
): Promise<{ el: FileUploaderRegular; router: RouterController }> => {
  ensureUploaderCtx(ctxName);
  const container = PubSub.getContainer(ctxName);
  const router = container?.get(RouterController);
  if (!router) throw new Error('router controller not resolved');
  const el = document.createElement('uc-file-uploader-regular') as FileUploaderRegular;
  el.setAttribute('ctx-name', ctxName);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  await delay(0);
  return { el, router };
};

describe('FileUploaderRegular (M-god step 6b-4 migration)', () => {
  it('declares its dependencies via static uses', () => {
    expect(FileUploaderRegular.uses).toEqual([RouterController, TelemetryManager]);
  });

  it('routes every activity to the foreground (modal) slot', async () => {
    const ctxName = freshCtxName();
    const { router } = await mount(ctxName);
    expect(router.navigationStrategy('start-from')).toBe('foreground');
    expect(router.navigationStrategy('upload-list')).toBe('foreground');
  });

  it('renders the static button by default and the dynamic button when dynamic-button is set', async () => {
    const staticCtx = freshCtxName();
    const { el: staticEl } = await mount(staticCtx);
    expect(staticEl.querySelector('uc-simple-btn')).not.toBeNull();
    expect(staticEl.querySelector('uc-dynamic-btn')).toBeNull();

    const dynCtx = freshCtxName();
    const { el: dynEl } = await mount(dynCtx, { 'dynamic-button': '' });
    expect(dynEl.isDynamicButtonActive).toBe(true);
    expect(dynEl.querySelector('uc-dynamic-btn')).not.toBeNull();
    expect(dynEl.querySelector('uc-simple-btn')).toBeNull();
  });

  it('renders no button in headless mode', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName, { headless: '' });
    expect(el.querySelector('uc-simple-btn')).toBeNull();
    expect(el.querySelector('uc-dynamic-btn')).toBeNull();
  });

  it('wires the start-from modal + upload-list modal into the template', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    expect(el.querySelector('uc-modal#start-from')).not.toBeNull();
    expect(el.querySelector('uc-modal#upload-list')).not.toBeNull();
    expect(el.querySelector('uc-plugin-activity-renderer')).not.toBeNull();
  });

  it('traverses onCancel via the RouterController when the cancel button is clicked', async () => {
    const ctxName = freshCtxName();
    const { el, router } = await mount(ctxName);
    const traverse = vi.spyOn(router, 'traverse');
    const cancelBtn = el.querySelector<HTMLButtonElement>('button.uc-secondary-btn');
    expect(cancelBtn).not.toBeNull();
    cancelBtn?.click();
    expect(traverse).toHaveBeenCalledWith('onCancel');
  });
});
