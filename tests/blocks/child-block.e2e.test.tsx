import { html } from 'lit';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { UploaderController } from '@/abstract/controllers/UploaderController';
import type { Config, UploadCtxProvider } from '@/index.ts';
import { ChildBlock } from '@/lit/ChildBlock';
import { LitBlock } from '@/lit/LitBlock';
import { getCtxName } from '../utils/getCtxName';
import { cleanup } from '../utils/test-renderer';
import '../../types/jsx';

class TestChildBlock extends ChildBlock {
  public static override styleAttrs = ['test-child-style'];
  public readyCount = 0;
  public releasedCount = 0;
  public throwOnRelease = false;
  public throwInReady = false;
  public cleanupRanAfterThrow = false;

  public fireDocumentedEvent(): void {
    this.emit('upload-click', undefined);
  }

  public routerOrNull() {
    return this.bag.routerOrNull;
  }

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [
      (listener: () => void) => ctrl.config.subscribe(listener),
      (listener: () => void) => ctrl.locale.subscribe(listener),
    ];
  }

  protected override controllerReady(): void {
    if (this.throwInReady) {
      throw new Error('boom in controllerReady');
    }
    this.readyCount += 1;
    if (this.throwOnRelease) {
      this.trackSub(() => {
        throw new Error('boom');
      });
      this.trackSub(() => {
        this.cleanupRanAfterThrow = true;
      });
    }
  }

  protected override controllerReleased(): void {
    this.releasedCount += 1;
  }

  public override render() {
    return html`<span class="pk">${this.uploaderOrNull?.config.get('pubkey') ?? ''}</span
      ><span class="l10n">${this.l10n('upload-file')}</span
      ><span class="inner" data-testid="inner"></span>`;
  }
}

class TestV1Host extends LitBlock {
  public override render() {
    return html`${this.yield('')}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'test-child-block': TestChildBlock;
    'test-v1-host': TestV1Host;
  }
}

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
  if (!customElements.get('test-child-block')) customElements.define('test-child-block', TestChildBlock);
  if (!customElements.get('test-v1-host')) customElements.define('test-v1-host', TestV1Host);
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

describe('ChildBlock', () => {
  it('adopts the controller via its own ctx-name attribute and renders', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const child = append('test-child-block', { 'ctx-name': ctxName });

    await expect.poll(() => child.querySelector('.pk')?.textContent).toBe('demopublickey');
    expect(child.readyCount).toBe(1);
    expect(child.hasAttribute('test-child-style')).toBe(true);
  });

  it('does not render before a controller is available', async () => {
    const child = append('test-child-block', { 'ctx-name': getCtxName() });
    // Wait for the (gated) initial update cycle to settle instead of a timed grace period.
    await child.updateComplete;
    expect(child.querySelector('.pk')).toBeNull();
    expect(child.readyCount).toBe(0);
  });

  it('inherits ctx-name from a v1 ancestor via context', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const host = append('test-v1-host', { 'ctx-name': ctxName });
    const child = document.createElement('test-child-block');
    host.append(child);

    await expect.poll(() => child.querySelector('.pk')?.textContent).toBe('demopublickey');
  });

  it('re-renders on controller change notifications (subscriptionsFor)', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const child = append('test-child-block', { 'ctx-name': ctxName });
    await expect.poll(() => child.querySelector('.pk')?.textContent).toBe('demopublickey');

    const config = page.getByTestId('uc-config').query()! as Config;
    config.pubkey = 'otherkey';
    await expect.poll(() => child.querySelector('.pk')?.textContent).toBe('otherkey');
  });

  it('subConfigValue fires immediately and dedupes per key', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const child = append('test-child-block', { 'ctx-name': ctxName });
    await expect.poll(() => child.readyCount).toBe(1);

    const seen: unknown[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: reaching into a protected test helper
    (child as any).subConfigValue('multiple', (v: boolean) => seen.push(v));
    expect(seen).toEqual([true]);

    const config = page.getByTestId('uc-config').query()! as Config;
    config.pubkey = 'unrelated-change';
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(seen).toEqual([true]); // unrelated key change must not re-fire

    config.multiple = false;
    await expect.poll(() => seen.length).toBe(2);
    expect(seen).toEqual([true, false]);
  });

  it('reflects data-testid under testMode and removes it when off', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const child = append('test-child-block', { 'ctx-name': ctxName });
    await expect.poll(() => child.getAttribute('data-testid')).toBe('test-child-block');

    const config = page.getByTestId('uc-config').query()! as Config;
    config.testMode = false;
    await expect.poll(() => child.hasAttribute('data-testid')).toBe(false);
  });

  it('rewrites descendant bare data-testid attrs to the scoped convention under testMode', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const child = append('test-child-block', { 'ctx-name': ctxName });

    await expect.poll(() => child.querySelector('.inner')?.getAttribute('data-testid')).toBe('test-child-block--inner');

    const config = page.getByTestId('uc-config').query()! as Config;
    config.testMode = false;
    await expect.poll(() => child.querySelector('.inner')?.hasAttribute('data-testid')).toBe(false);
  });

  it('releases subscriptions on disconnect and re-adopts on reconnect', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const child = append('test-child-block', { 'ctx-name': ctxName });
    await expect.poll(() => child.readyCount).toBe(1);

    child.remove();
    expect(child.releasedCount).toBe(1);

    document.body.append(child);
    await expect.poll(() => child.readyCount).toBe(2);
  });

  it('adopts when ctx-name is set after connection', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const child = append('test-child-block');
    await child.updateComplete;
    expect(child.readyCount).toBe(0);

    child.setAttribute('ctx-name', ctxName);
    await expect.poll(() => child.querySelector('.pk')?.textContent).toBe('demopublickey');
    expect(child.readyCount).toBe(1);
  });

  it('releases the controller and re-gates when ctx-name switches to a not-yet-available ctx', async () => {
    const ctxNameA = getCtxName();
    const ctxNameB = getCtxName();
    page.render(<uc-config ctx-name={ctxNameA} pubkey="demopublickey" testMode></uc-config>);
    const child = append('test-child-block', { 'ctx-name': ctxNameA });
    await expect.poll(() => child.querySelector('.pk')?.textContent).toBe('demopublickey');

    child.setAttribute('ctx-name', ctxNameB);
    await expect.poll(() => child.releasedCount).toBe(1);
    // biome-ignore lint/suspicious/noExplicitAny: reaching into a protected getter
    expect((child as any).uploaderOrNull).toBeNull();

    append('uc-config', { 'ctx-name': ctxNameB, pubkey: 'otherkey' });
    await expect.poll(() => child.querySelector('.pk')?.textContent).toBe('otherkey');
    expect(child.readyCount).toBe(2);
  });

  it('isolates a throwing unsubscriber during release, warns, and finishes teardown', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const child = document.createElement('test-child-block');
    child.throwOnRelease = true;
    child.setAttribute('ctx-name', ctxName);
    document.body.append(child);
    appended.push(child);
    await expect.poll(() => child.readyCount).toBe(1);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      child.remove();
      expect(child.releasedCount).toBe(1);
      expect(child.cleanupRanAfterThrow).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('teardown threw'), expect.any(Error));
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('throws a descriptive error when uploader is read before adoption', () => {
    const child = document.createElement('test-child-block');
    // biome-ignore lint/suspicious/noExplicitAny: reaching into a protected getter
    expect(() => (child as any).uploader).toThrowError(/test-child-block/);
  });

  it('l10n resolves dictionary keys once the locale is loaded', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const child = append('test-child-block', { 'ctx-name': ctxName });
    await expect.poll(() => child.querySelector('.l10n')?.textContent).toBe('Upload file');
  });

  it('l10n falls back to the key for unknown keys', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const child = append('test-child-block', { 'ctx-name': ctxName });
    await expect.poll(() => child.readyCount).toBe(1);
    // biome-ignore lint/suspicious/noExplicitAny: reaching into the helper directly
    expect((child as any).l10n('definitely-not-a-key')).toBe('definitely-not-a-key');
  });

  it('isolates a throwing controllerReady during adoption, warns, and finishes the update', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const child = document.createElement('test-child-block');
    child.throwInReady = true;
    child.setAttribute('ctx-name', ctxName);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      document.body.append(child);
      appended.push(child);

      // Adoption must still complete (post-hook requestUpdate ran) even though
      // controllerReady threw.
      await expect.poll(() => child.querySelector('.pk')?.textContent).toBe('demopublickey');
      expect(child.readyCount).toBe(0);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('controllerReady threw during adoption'),
        expect.any(Error),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('bag.routerOrNull is null (no throw) before adoption and resolves once a controller is adopted', async () => {
    const child = document.createElement('test-child-block');
    // No ctx-name at all: `_requireCtx` throws internally; `routerOrNull` must
    // swallow that and report `null`, same contract as `uploadCollectionOrNull`/`apiOrNull`.
    expect(child.routerOrNull()).toBeNull();

    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    child.setAttribute('ctx-name', ctxName);
    document.body.append(child);
    appended.push(child);

    await expect.poll(() => child.readyCount).toBe(1);
    expect(child.routerOrNull()).not.toBeNull();
  });

  it('emit dispatches the documented event on the same-ctx uc-upload-ctx-provider', async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );
    const child = append('test-child-block', { 'ctx-name': ctxName });
    await expect.poll(() => child.readyCount).toBe(1);

    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const handler = vi.fn<(e: CustomEvent<unknown>) => void>();
    ctxProvider.addEventListener('upload-click', handler);

    child.fireDocumentedEvent();

    await expect.poll(() => handler.mock.calls.length).toBe(1);
  });

  it('emit is a silent no-op once the ctx has been torn down', async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </>,
    );
    const child = append('test-child-block', { 'ctx-name': ctxName });
    await expect.poll(() => child.readyCount).toBe(1);

    // Disconnect the child (releasing its controller/subscriptions, same as
    // any real unmount) and unmount the rest of the uploader; the ctx
    // destroys via a deferred task once the last block disconnects. The
    // child's `ctx-name` attribute is untouched by `remove()` — same as a
    // queued event callback holding a reference to an unmounted block.
    child.remove();
    cleanup();
    const { PubSub } = await import('@/lit/PubSubCompat.js');
    await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(false);

    const errors: string[] = [];
    const onError = (event: ErrorEvent) => {
      errors.push(String(event.error?.message ?? event.message));
      event.preventDefault();
    };
    window.addEventListener('error', onError);
    try {
      expect(() => child.fireDocumentedEvent()).not.toThrow();
    } finally {
      window.removeEventListener('error', onError);
    }
    expect(errors).toEqual([]);
  });

  it('releases the controller when its ctx is destroyed while still connected, and a later render throws no window errors', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const child = append('test-child-block', { 'ctx-name': ctxName });
    await expect.poll(() => child.querySelector('.pk')?.textContent).toBe('demopublickey');
    expect(child.releasedCount).toBe(0);

    // Tear down the ctx while the fixture stays connected: only the
    // uc-config (a v1 LitBlock) unmounts, so the ctx is destroyed via the
    // deferred blocksRegistry-empty task, exactly as when the last v1 block
    // elsewhere in the tree disconnects.
    cleanup();
    const { PubSub } = await import('@/lit/PubSubCompat.js');
    await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(false);

    expect(child.isConnected).toBe(true);
    await expect.poll(() => child.releasedCount).toBe(1);
    // biome-ignore lint/suspicious/noExplicitAny: reaching into a protected getter
    expect((child as any).uploaderOrNull).toBeNull();

    const errors: string[] = [];
    const onError = (event: ErrorEvent) => {
      errors.push(String(event.error?.message ?? event.message));
      event.preventDefault();
    };
    window.addEventListener('error', onError);
    try {
      child.requestUpdate();
      await child.updateComplete;
    } finally {
      window.removeEventListener('error', onError);
    }
    expect(errors).toEqual([]);
  });
});

/**
 * Gap-fill ahead of M9o Task 3 (unified teardown: a ctx dies when
 * `*blocksRegistry` is empty/absent AND `UploaderRegistry` has no
 * `whenAvailable` consumers for that ctxName). Pins the CURRENT observable
 * end-state of a mixed v1 + ChildBlock composition — today, teardown is
 * driven solely by `*blocksRegistry` emptiness (v1 `LitBlock` instances);
 * `ChildBlock`'s `UploaderRegistry.whenAvailable` subscription plays no part
 * in keeping the ctx alive or tearing it down. This is the coexistence
 * behavior Task 3's refcount must preserve (or deliberately change).
 */
describe('mixed lifecycle (v1 blocks + ChildBlock on one ctx)', () => {
  it('stays alive while any v1 block remains, tears down only once the last v1 block disconnects — regardless of the still-connected ChildBlock', async () => {
    const ctxName = getCtxName();
    const { PubSub } = await import('@/lit/PubSubCompat.js');
    const { delay } = await import('@/utils/delay.js');

    // Two v1 LitBlock instances (both register in `*blocksRegistry`) on the
    // same ctx — `uc-upload-ctx-provider` is a `ChildBlock` (M9b), not a
    // `LitBlock`, so a second `<uc-config>` is the plain way to get a second
    // `*blocksRegistry` member — plus a ported ChildBlock on the same ctx.
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const configA = page.getByTestId('uc-config').query()!;

    const configB = document.createElement('uc-config');
    configB.setAttribute('ctx-name', ctxName);
    document.body.append(configB);
    appended.push(configB);

    const child = append('test-child-block', { 'ctx-name': ctxName });
    await expect.poll(() => child.readyCount).toBe(1);
    await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(true);

    // Disconnect ONE of the two v1 blocks: `*blocksRegistry` still holds the
    // other v1 block, so the ctx must stay alive and the ChildBlock keeps its
    // adopted controller — even past the deferred destroy-check window.
    configA.remove();
    await delay(0);

    expect(PubSub.hasCtx(ctxName)).toBe(true);
    expect(child.releasedCount).toBe(0);
    // biome-ignore lint/suspicious/noExplicitAny: reaching into a protected getter
    expect((child as any).uploaderOrNull).not.toBeNull();

    // Disconnect the LAST v1 block: `*blocksRegistry` empties and the ctx
    // tears down via the deferred task. The ChildBlock is not part of
    // `*blocksRegistry` and does not keep the ctx alive on its own — it just
    // releases once notified.
    configB.remove();
    await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(false);
    await expect.poll(() => child.releasedCount).toBe(1);
    // biome-ignore lint/suspicious/noExplicitAny: reaching into a protected getter
    expect((child as any).uploaderOrNull).toBeNull();
  });
});
