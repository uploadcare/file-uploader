import { afterEach, describe, expect, it } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { PubSub } from '../../lit/PubSubCompat';
import { delay } from '../../utils/delay';
import { Modal } from './Modal';

// Idempotent (same path as defineComponents(UC)).
Modal.reg('uc-modal');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `modal-spec-${seq++}`;
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
  id: string,
): Promise<{ el: Modal; router: RouterController; config: ConfigController }> => {
  ensureUploaderCtx(ctxName);
  const container = PubSub.getContainer(ctxName);
  const router = container?.get(RouterController);
  const config = container?.get(ConfigController);
  if (!router || !config) throw new Error('controllers not resolved');
  const el = document.createElement('uc-modal') as Modal;
  el.id = id;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return { el, router, config };
};

const dialogOf = (el: Modal): HTMLDialogElement | null => el.querySelector('dialog');

describe('Modal (M-god step 6b-3 migration)', () => {
  it('declares its dependencies via static uses', () => {
    expect(Modal.uses).toEqual([ConfigController, RouterController]);
  });

  it('opens/closes the <dialog> reactively when the router modal slot changes (no subRouter)', async () => {
    const ctxName = freshCtxName();
    const { el, router } = await mount(ctxName, 'camera');
    const dialog = dialogOf(el);
    expect(dialog).not.toBeNull();
    // Nothing open yet: the router modal slot is null.
    expect(dialog?.open).toBe(false);

    // Router modal slot -> this modal's id. `router.modal` is a tracked signal,
    // so willUpdate re-runs and show() opens the dialog. No imperative wiring.
    router.openModal('camera');
    await el.updateComplete;
    await delay(0);
    expect(dialog?.open).toBe(true);
    expect(el.getAttribute('aria-modal')).toBe('true');

    router.closeModal();
    await el.updateComplete;
    await delay(0);
    expect(dialog?.open).toBe(false);
    expect(el.getAttribute('aria-modal')).toBe('false');
  });

  it('does not open for a modal slot that is not this modal id', async () => {
    const ctxName = freshCtxName();
    const { el, router } = await mount(ctxName, 'camera');

    router.openModal('upload-list');
    await el.updateComplete;
    await delay(0);
    expect(dialogOf(el)?.open).toBe(false);
  });

  it('toggles the host [strokes] attribute reactively from the modalBackdropStrokes config (getTracked)', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mount(ctxName, 'camera');
    // Default modalBackdropStrokes is false -> host must not carry [strokes].
    expect(el.hasAttribute('strokes')).toBe(false);

    config.set('modalBackdropStrokes', true);
    await el.updateComplete;
    await delay(0);
    expect(el.hasAttribute('strokes')).toBe(true);

    config.set('modalBackdropStrokes', false);
    await el.updateComplete;
    await delay(0);
    expect(el.hasAttribute('strokes')).toBe(false);
  });
});
