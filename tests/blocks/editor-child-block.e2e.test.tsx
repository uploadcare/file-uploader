import { ContextProvider } from '@lit/context';
import { html, LitElement } from 'lit';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  CloudImageEditorController,
  type EditorServices,
} from '@/blocks/CloudImageEditor/src/CloudImageEditorController';
import { cloudImageEditorContext, EditorBlock } from '@/blocks/CloudImageEditor/src/editor-context';
import { LightDomMixin } from '@/lit/LightDomMixin';
import { RegisterableElementMixin } from '@/lit/RegisterableElementMixin';
import { subscription, type Unsubscribe } from '@/lit/subscription';
import '../../types/jsx';

/**
 * Throwaway coverage tags for M12 P3 (reworked) infrastructure: a light,
 * non-`ChildBlock` root that constructs a `CloudImageEditorController` with
 * simple inline services and provides it via `ContextProvider`, and an
 * `EditorBlock` consumer. Not real editor blocks — just enough to prove the
 * context + light-base wiring per the "Bundle-independence constraints" (the
 * root here stands in for the real `CloudImageEditorBlock`, wired in P5).
 */
const TestEditorRootBase = RegisterableElementMixin(LightDomMixin(LitElement));

class TestEditorRoot extends TestEditorRootBase {
  public readonly telemetrySendEvent = vi.fn();
  public readonly telemetrySendEventError = vi.fn();
  public readonly controller = new CloudImageEditorController({
    l10n: (key) => (key === 'cancel' ? 'Cancel' : key),
    getConfig: ((key: string) => (key === 'pubkey' ? 'demopublickey' : undefined)) as EditorServices['getConfig'],
    telemetry: {
      sendEvent: this.telemetrySendEvent,
      sendEventError: this.telemetrySendEventError,
      sendActionEvent: vi.fn(),
    },
    proxyUrl: async (url) => url,
  });

  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: `ContextProvider` provides by side effect — the field keeps it alive for the host's lifetime.
  private readonly _provider = new ContextProvider(this, {
    context: cloudImageEditorContext,
    initialValue: this.controller,
  });

  public override render() {
    // Light-DOM — render via `this.yield('')`, NOT a literal `<slot>`, or
    // projected children silently vanish (M12 PoC gotcha).
    return html`${this.yield('')}`;
  }
}

class TestEditorChild extends EditorBlock {
  public override render() {
    return html`<span class="tab-id">${this.editorControllerOrNull?.tabId ?? ''}</span
      ><span class="l10n">${this.editorControllerOrNull?.l10n('cancel') ?? ''}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-test-editor-root': TestEditorRoot;
    'uc-test-editor-child': TestEditorChild;
  }
}

beforeAll(() => {
  if (!customElements.get('uc-test-editor-root')) customElements.define('uc-test-editor-root', TestEditorRoot);
  if (!customElements.get('uc-test-editor-child')) customElements.define('uc-test-editor-child', TestEditorChild);
});

const appended: HTMLElement[] = [];
const append = <K extends keyof HTMLElementTagNameMap>(tag: K, id: string) => {
  const el = document.createElement(tag);
  el.id = id;
  document.body.append(el);
  appended.push(el);
  return el;
};

afterEach(() => {
  for (const el of appended) el.remove();
  appended.length = 0;
});

describe('EditorBlock / cloudImageEditorContext (light, non-ChildBlock base)', () => {
  it('resolves the provided controller, renders its state, reads the injected l10n service, and re-renders on set()', async () => {
    const root = append('uc-test-editor-root', 'test-editor-root-direct');
    const child = document.createElement('uc-test-editor-child');
    child.id = 'test-editor-child-direct';
    root.append(child);

    await expect.poll(() => child.querySelector('.tab-id')?.textContent).toBe('crop');
    // Services surface (`l10n`), read through the controller — not ChildBlock.
    await expect.poll(() => child.querySelector('.l10n')?.textContent).toBe('Cancel');

    root.controller.tabId = 'tuning';
    await expect.poll(() => child.querySelector('.tab-id')?.textContent).toBe('tuning');
  });

  it('resolves the editor context through an intervening plain element, two levels deep', async () => {
    const root = append('uc-test-editor-root', 'test-editor-root-nested');
    const wrapper = document.createElement('div');
    root.append(wrapper);
    const child = document.createElement('uc-test-editor-child');
    child.id = 'test-editor-child-nested';
    wrapper.append(child);

    await expect.poll(() => child.querySelector('.tab-id')?.textContent).toBe('crop');

    root.controller.tabId = 'filters';
    await expect.poll(() => child.querySelector('.tab-id')?.textContent).toBe('filters');
  });

  it('stops re-rendering once the child disconnects (no dangling subscription)', async () => {
    const root = append('uc-test-editor-root', 'test-editor-root-teardown');
    const child = document.createElement('uc-test-editor-child');
    child.id = 'test-editor-child-teardown';
    root.append(child);
    await expect.poll(() => child.querySelector('.tab-id')?.textContent).toBe('crop');

    const requestUpdateSpy = vi.spyOn(child, 'requestUpdate');
    child.remove();
    // `SignalWatcher` stops watching a microtask after the disconnect, so a move within the same task keeps it.
    await Promise.resolve();
    requestUpdateSpy.mockClear();

    root.controller.tabId = 'tuning';
    // Give any (incorrect) surviving subscription a tick to fire.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(requestUpdateSpy).not.toHaveBeenCalled();
  });

  it('keeps re-rendering after a light-DOM reconnect of the same node (the reconnect-fix guard)', async () => {
    const root = append('uc-test-editor-root', 'test-editor-root-reconnect');
    const child = document.createElement('uc-test-editor-child');
    child.id = 'test-editor-child-reconnect';
    root.append(child);
    await expect.poll(() => child.querySelector('.tab-id')?.textContent).toBe('crop');

    // Light-DOM reconnect: remove + re-append the SAME node — exactly what an
    // ancestor re-render via `this.yield('')` does under the hood
    // (`insertBefore` fires disconnectedCallback + connectedCallback
    // back-to-back on the same element). The `CloudImageEditorContextController`
    // must re-adopt the controller (re-running its attach callbacks); the reconnect fix (resetting
    // `_controller` in `hostDisconnected`) exists precisely so `_attach`'s
    // identity-dedup doesn't silently drop it. Without the fix this poll times
    // out (child stays 'crop').
    child.remove();
    root.append(child);

    root.controller.tabId = 'tuning';
    await expect.poll(() => child.querySelector('.tab-id')?.textContent).toBe('tuning');
  });

  it('root teardown does not throw and leaves the controller usable (root does not own controller.destroy in this phase)', async () => {
    const root = append('uc-test-editor-root', 'test-editor-root-remove');
    const child = document.createElement('uc-test-editor-child');
    root.append(child);
    await expect.poll(() => child.querySelector('.tab-id')?.textContent).toBe('crop');

    const { controller } = root;
    expect(() => root.remove()).not.toThrow();
    // The controller itself outlives this throwaway root (its lifecycle is
    // owned by whichever real element provides it — P5); it must still be a
    // plain, usable object post-disconnect.
    expect(() => {
      controller.tabId = 'tuning';
    }).not.toThrow();
    expect(controller.tabId).toBe('tuning');
  });
});

class TestEditorKeyChild extends EditorBlock {
  public readonly tabIds: string[] = [];

  @subscription()
  protected _watchTabId(): Unsubscribe {
    return this.editorController.observe('tabId', (tabId) => this.tabIds.push(tabId), { immediate: true });
  }

  public override render() {
    return html``;
  }
}

if (!customElements.get('uc-test-editor-key-child'))
  customElements.define('uc-test-editor-key-child', TestEditorKeyChild);

describe('EditorBlock state reactions', () => {
  const services = (l10n: EditorServices['l10n']): EditorServices => ({
    l10n,
    getConfig: (() => undefined) as EditorServices['getConfig'],
    telemetry: { sendEvent: vi.fn(), sendEventError: vi.fn(), sendActionEvent: vi.fn() },
    proxyUrl: async (url) => url,
  });

  it('re-renders a child reading l10n when the services change', async () => {
    const root = append('uc-test-editor-root', 'test-editor-root-services');
    const child = document.createElement('uc-test-editor-child');
    root.append(child);
    await expect.poll(() => child.querySelector('.l10n')?.textContent).toBe('Cancel');

    root.controller.setServices(services((key) => `de:${key}`));

    await expect.poll(() => child.querySelector('.l10n')?.textContent).toBe('de:cancel');
  });

  it('runs a per-key reaction with the current value, then only when that key changes, and again after a reconnect', async () => {
    const root = append('uc-test-editor-root', 'test-editor-root-key');
    // After the root's first render, so its `yield` does not move (and so re-attach) the child.
    await root.updateComplete;
    const child = document.createElement('uc-test-editor-key-child') as TestEditorKeyChild;
    root.append(child);
    await expect.poll(() => child.tabIds).toEqual(['crop']);

    root.controller.networkProblems = true;
    root.controller.tabId = 'tuning';
    expect(child.tabIds).toEqual(['crop', 'tuning']);

    child.remove();
    root.controller.tabId = 'filters';
    expect(child.tabIds).toEqual(['crop', 'tuning']);

    root.append(child);
    await expect.poll(() => child.tabIds).toEqual(['crop', 'tuning', 'filters']);
    root.controller.tabId = 'crop';
    expect(child.tabIds).toEqual(['crop', 'tuning', 'filters', 'crop']);
  });

  it('leaves an operation control without an operation inactive when the transformations change', async () => {
    const root = append('uc-test-editor-root', 'test-editor-root-operation');
    const control = document.createElement('uc-editor-operation-control');
    root.append(control);
    await control.updateComplete;

    root.controller.editorTransformations = { brightness: 50 };

    expect(control.active).toBe(false);
  });
});
