import { afterEach, describe, expect, it } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
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
    UploaderRegistry.dispose(name);
  }
});

const mount = async (
  ctxName: string,
  id: string,
): Promise<{ el: Modal; router: RouterController; config: ConfigController }> => {
  ensureUploaderCtx(ctxName);
  const container = UploaderRegistry.get(ctxName);
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

describe('Modal', () => {
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
    // `showModal()` already makes the <dialog> modal; the role-less host carries no `aria-modal`.
    expect(el.hasAttribute('aria-modal')).toBe(false);

    router.closeModal();
    await el.updateComplete;
    await delay(0);
    expect(dialog?.open).toBe(false);
    expect(el.hasAttribute('aria-modal')).toBe(false);
  });

  it('names the <dialog> from its dialog-label, translating a key and passing plain text', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName, 'camera');
    expect(dialogOf(el)?.hasAttribute('aria-label')).toBe(false);

    el.setAttribute('dialog-label', 'select-file-source');
    await el.updateComplete;
    expect(dialogOf(el)?.getAttribute('aria-label')).toBe('Select file source');

    el.setAttribute('dialog-label', 'Pick a file');
    await el.updateComplete;
    expect(dialogOf(el)?.getAttribute('aria-label')).toBe('Pick a file');
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

  it('closeDialog is a no-op after disconnect — null-tolerant useOrNull(RouterController) read', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName, 'camera');
    // Disconnect releases the container (`_container` -> null). A native <dialog>
    // "close" event can still land after teardown; `closeDialog` reads the router
    // via `useOrNull` (was `bag.routerOrNull`) and must not throw when it's gone.
    el.remove();
    expect(() => (el as unknown as { closeDialog: () => void }).closeDialog()).not.toThrow();
  });
});
