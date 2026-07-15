import { ContextProvider } from '@lit/context';
import { html } from 'lit';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { CloudImageEditorController } from '@/abstract/controllers/CloudImageEditorController';
import { cloudImageEditorContext, EditorChildBlock } from '@/blocks/CloudImageEditor/src/editor-context';
import { ChildBlock } from '@/lit/ChildBlock';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

/**
 * Throwaway coverage tags for M12 P3 infrastructure: a `ChildBlock`-rooted
 * provider (real editor blocks provide the controller from `P5` onward — this
 * root stands in for that) and an `EditorChildBlock` consumer. Not real
 * editor blocks — just enough to prove the context + base wiring.
 */
class TestEditorRoot extends ChildBlock {
  public readonly controller = new CloudImageEditorController();
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: `ContextProvider` provides by side effect — the field keeps it alive for the host's lifetime.
  private readonly _provider = new ContextProvider(this, {
    context: cloudImageEditorContext,
    initialValue: this.controller,
  });

  public override render() {
    // ChildBlock is light-DOM (LightDomMixin) — render via `this.yield('')`,
    // NOT a literal `<slot>`, or projected children silently vanish (M12 PoC
    // gotcha).
    return html`${this.yield('')}`;
  }
}

class TestEditorChild extends EditorChildBlock {
  public override render() {
    return html`<span class="tab-id">${this.editorControllerOrNull?.get('*tabId') ?? ''}</span
      ><span class="l10n">${this.l10n('cancel')}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-test-editor-root': TestEditorRoot;
    'uc-test-editor-child': TestEditorChild;
  }
}

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
  if (!customElements.get('uc-test-editor-root')) customElements.define('uc-test-editor-root', TestEditorRoot);
  if (!customElements.get('uc-test-editor-child')) customElements.define('uc-test-editor-child', TestEditorChild);
});

const appended: HTMLElement[] = [];
const append = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}) => {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.append(el);
  appended.push(el);
  return el;
};

afterEach(() => {
  for (const el of appended) el.remove();
  appended.length = 0;
});

describe('EditorChildBlock / cloudImageEditorContext', () => {
  it('resolves the provided controller, renders its state, reads the uploader l10n surface, and re-renders on set()', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const root = append('uc-test-editor-root', { 'ctx-name': ctxName });
    root.id = 'test-editor-root-direct';
    const child = document.createElement('uc-test-editor-child');
    child.id = 'test-editor-child-direct';
    root.append(child);

    await expect.poll(() => child.querySelector('.tab-id')?.textContent).toBe('crop');
    // Uploader surface (`l10n`) resolved alongside the editor context, on the
    // same ChildBlock/EditorChildBlock.
    await expect.poll(() => child.querySelector('.l10n')?.textContent).toBe('Cancel');

    root.controller.set('*tabId', 'tuning');
    await expect.poll(() => child.querySelector('.tab-id')?.textContent).toBe('tuning');
  });

  it('resolves the editor context through an intervening plain element, two levels deep', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const root = append('uc-test-editor-root', { 'ctx-name': ctxName });
    root.id = 'test-editor-root-nested';
    const wrapper = document.createElement('div');
    root.append(wrapper);
    const child = document.createElement('uc-test-editor-child');
    child.id = 'test-editor-child-nested';
    wrapper.append(child);

    await expect.poll(() => child.querySelector('.tab-id')?.textContent).toBe('crop');

    root.controller.set('*tabId', 'filters');
    await expect.poll(() => child.querySelector('.tab-id')?.textContent).toBe('filters');
  });

  it('stops re-rendering once the child disconnects (no dangling subscription)', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const root = append('uc-test-editor-root', { 'ctx-name': ctxName });
    const child = document.createElement('uc-test-editor-child');
    root.append(child);
    await expect.poll(() => child.querySelector('.tab-id')?.textContent).toBe('crop');

    const requestUpdateSpy = vi.spyOn(child, 'requestUpdate');
    child.remove();
    requestUpdateSpy.mockClear();

    root.controller.set('*tabId', 'tuning');
    // Give any (incorrect) surviving subscription a tick to fire.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(requestUpdateSpy).not.toHaveBeenCalled();
  });

  it('keeps re-rendering after a light-DOM reconnect of the same node (the reconnect-fix guard)', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const root = append('uc-test-editor-root', { 'ctx-name': ctxName });
    root.id = 'test-editor-root-reconnect';
    const child = document.createElement('uc-test-editor-child');
    child.id = 'test-editor-child-reconnect';
    root.append(child);
    await expect.poll(() => child.querySelector('.tab-id')?.textContent).toBe('crop');

    // Light-DOM reconnect: remove + re-append the SAME node — exactly what an
    // ancestor re-render via `this.yield('')` does under the hood
    // (`insertBefore` fires disconnectedCallback + connectedCallback
    // back-to-back on the same element). The `CloudImageEditorContextController`
    // must re-establish its re-render subscription; the reconnect fix (resetting
    // `_controller` in `hostDisconnected`) exists precisely so `_attach`'s
    // identity-dedup doesn't silently drop it. Without the fix this poll times
    // out (child stays 'crop').
    child.remove();
    root.append(child);

    root.controller.set('*tabId', 'tuning');
    await expect.poll(() => child.querySelector('.tab-id')?.textContent).toBe('tuning');
  });

  it('root teardown does not throw and leaves the controller usable (root does not own controller.destroy in this phase)', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const root = append('uc-test-editor-root', { 'ctx-name': ctxName });
    const child = document.createElement('uc-test-editor-child');
    root.append(child);
    await expect.poll(() => child.querySelector('.tab-id')?.textContent).toBe('crop');

    const { controller } = root;
    expect(() => root.remove()).not.toThrow();
    // The controller itself outlives this throwaway root (its lifecycle is
    // owned by whichever real element provides it — P5); it must still be a
    // plain, usable object post-disconnect.
    expect(() => controller.set('*tabId', 'tuning')).not.toThrow();
    expect(controller.get('*tabId')).toBe('tuning');
  });
});
