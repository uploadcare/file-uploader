import { html } from 'lit';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { ConfigController } from '@/abstract/controllers/ConfigController';
import { RouterController } from '@/abstract/controllers/RouterController';
import { ControllerContainer } from '@/abstract/di/ControllerContainer';
import { UploaderRegistry } from '@/abstract/UploaderRegistry';
import type { Config, UploadCtxProvider } from '@/index.ts';
import { ChildBlock } from '@/lit/ChildBlock';
import { getCtxName } from '../utils/getCtxName';
import { containerOf, hasCtx } from '../utils/registry';
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
    return this.useOrNull(RouterController);
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
    return html`<span class="pk">${this.useOrNull(ConfigController)?.getTracked('pubkey') ?? ''}</span
      ><span class="l10n">${this.l10n('upload-file')}</span
      ><span class="inner" data-testid="inner"></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'test-child-block': TestChildBlock;
  }
}

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
  if (!customElements.get('test-child-block')) customElements.define('test-child-block', TestChildBlock);
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

  it('does not render before a ctx-name resolves (nothing to bootstrap)', async () => {
    // No `ctx-name` attribute and no inherited v1 ancestor: `effectiveCtxName`
    // is undefined, so `_watchRegistry` has nothing to bootstrap or watch —
    // distinct from the M9o self-bootstrap case below, where a ctx-name IS
    // present and the block creates its own ctx rather than gating forever.
    const child = append('test-child-block');
    // Wait for the (gated) initial update cycle to settle instead of a timed grace period.
    await child.updateComplete;
    expect(child.querySelector('.pk')).toBeNull();
    expect(child.readyCount).toBe(0);
  });

  it('self-bootstraps its own ctx and renders immediately with no v1 block ever present (M9o)', async () => {
    const ctxName = getCtxName();
    expect(hasCtx(ctxName)).toBe(false);

    const child = append('test-child-block', { 'ctx-name': ctxName });

    await expect.poll(() => child.readyCount).toBe(1);
    expect(hasCtx(ctxName)).toBe(true);
    // Plain ConfigController defaults — nothing seeded them beyond
    // `ensureUploaderCtx`'s own bootstrap.
    expect(child.querySelector('.pk')?.textContent).toBe('');
  });

  it('adopts a container already registered under its ctx-name (pre-existing registry entry)', async () => {
    // A `ControllerContainer` can already be registered for a ctx-name before
    // the block connects — e.g. registered directly via `UploaderRegistry`, or
    // by a sibling that got there first. The block must adopt that existing
    // container (its `whenAvailable` watch fires synchronously with it) rather
    // than gating forever or clobbering it with a second one.
    const ctxName = getCtxName();
    const container = new ControllerContainer();
    UploaderRegistry.register(ctxName, container);
    expect(hasCtx(ctxName)).toBe(true);

    const child = append('test-child-block', { 'ctx-name': ctxName });

    await expect.poll(() => child.readyCount, { timeout: 2000 }).toBe(1);
    // biome-ignore lint/suspicious/noExplicitAny: reaching into a protected getter
    expect((child as any).useOrNull(ConfigController)).not.toBeNull();
    // Adopted the exact container that was pre-registered, not a replacement.
    expect(containerOf(ctxName)).toBe(container);
  });

  it('re-renders on controller change notifications (getTracked)', async () => {
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

  it('releases the old controller and self-bootstraps a fresh ctx when ctx-name switches to a not-yet-available name (M9o)', async () => {
    const ctxNameA = getCtxName();
    const ctxNameB = getCtxName();
    page.render(<uc-config ctx-name={ctxNameA} pubkey="demopublickey" testMode></uc-config>);
    const child = append('test-child-block', { 'ctx-name': ctxNameA });
    await expect.poll(() => child.querySelector('.pk')?.textContent).toBe('demopublickey');

    child.setAttribute('ctx-name', ctxNameB);
    await expect.poll(() => child.releasedCount).toBe(1);
    // Pre-M9o this block re-gated and waited forever absent a v1 block: now
    // `_watchRegistry` self-bootstraps `ctxNameB` synchronously (no creator
    // exists yet), so the controller is never actually null here — it is the
    // freshly-bootstrapped one, seeded with plain config defaults (`pubkey`
    // is the ConfigController default `''`, not yet `demopublickey`/`otherkey`).
    // biome-ignore lint/suspicious/noExplicitAny: reaching into a protected getter
    expect((child as any).useOrNull(ConfigController)).not.toBeNull();
    expect(child.readyCount).toBe(2);
    expect(child.querySelector('.pk')?.textContent).toBe('');
    expect(hasCtx(ctxNameB)).toBe(true);

    // A v1 block arriving later for the same ctx-name must find the
    // self-bootstrapped ctx (via `UploaderRegistry.ensure` returning the cached
    // container inside `ensureUploaderCtx`) rather than clobbering it with a
    // second one — its own config values apply on top, same seed either way.
    append('uc-config', { 'ctx-name': ctxNameB, pubkey: 'otherkey' });
    await expect.poll(() => child.querySelector('.pk')?.textContent).toBe('otherkey');
    // No extra release/adopt cycle: the v1 block joins the existing
    // controller instead of triggering a `UploaderRegistry` replacement.
    expect(child.readyCount).toBe(2);
    expect(child.releasedCount).toBe(1);
  });

  it('tears down an abandoned self-bootstrapped ctx once unreferenced when ctx-name switches while connected (M9o follow-up)', async () => {
    const ctxNameA = getCtxName();
    const ctxNameB = getCtxName();
    const { delay } = await import('@/utils/delay.js');
    expect(hasCtx(ctxNameA)).toBe(false);

    // No ctx-name yet: nothing to bootstrap.
    const child = append('test-child-block');
    await child.updateComplete;

    // Assign ctx-name=A: self-bootstraps ctxA (no v1 block, no other
    // consumer) and adopts its controller.
    child.setAttribute('ctx-name', ctxNameA);
    await expect.poll(() => child.readyCount).toBe(1);
    expect(hasCtx(ctxNameA)).toBe(true);

    // Switch to ctx-name=B while still connected: the old watch on ctxA is
    // dropped and ctxB is self-bootstrapped and adopted. Nothing else was
    // ever referencing ctxA, so once the deferred check fires it must be
    // torn down instead of leaking.
    child.setAttribute('ctx-name', ctxNameB);
    await expect.poll(() => child.releasedCount).toBe(1);
    expect(hasCtx(ctxNameB)).toBe(true);

    await delay(0);

    expect(hasCtx(ctxNameA)).toBe(false);
    expect(hasCtx(ctxNameB)).toBe(true);
    // biome-ignore lint/suspicious/noExplicitAny: reaching into a protected getter
    expect((child as any).useOrNull(ConfigController)).not.toBeNull();
  });

  it('does not tear down the abandoned ctx on switch when another consumer still references it', async () => {
    const ctxNameA = getCtxName();
    const ctxNameB = getCtxName();
    const { delay } = await import('@/utils/delay.js');

    // ctxA has a v1 block keeping it alive, plus a self-bootstrapping
    // ChildBlock that will later switch away from it.
    page.render(<uc-config ctx-name={ctxNameA} pubkey="demopublickey" testMode></uc-config>);
    const child = append('test-child-block', { 'ctx-name': ctxNameA });
    await expect.poll(() => child.readyCount).toBe(1);
    expect(hasCtx(ctxNameA)).toBe(true);

    child.setAttribute('ctx-name', ctxNameB);
    await expect.poll(() => child.releasedCount).toBe(1);
    expect(hasCtx(ctxNameB)).toBe(true);

    await delay(0);

    // The v1 block is still on ctxA: the deferred check must find it
    // referenced and leave it alone.
    expect(hasCtx(ctxNameA)).toBe(true);
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

  it('throws a descriptive error when a controller is resolved via use() before adoption', () => {
    const child = document.createElement('test-child-block');
    // biome-ignore lint/suspicious/noExplicitAny: reaching into a protected method
    expect(() => (child as any).use(ConfigController)).toThrowError(/test-child-block/);
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
    await expect.poll(() => hasCtx(ctxName)).toBe(false);

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

  it('releases the controller only once every consumer (v1 AND this still-connected ChildBlock) has let go, and a later render throws no window errors', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const child = append('test-child-block', { 'ctx-name': ctxName });
    await expect.poll(() => child.querySelector('.pk')?.textContent).toBe('demopublickey');
    expect(child.releasedCount).toBe(0);

    // Unmount only the uc-config (a v1 LitBlock) while the fixture stays
    // connected. Pre-M9o-Task-3 this alone destroyed the ctx (teardown was
    // driven solely by `*blocksRegistry`); under the unified consumer
    // refcount, the ChildBlock is still watching via `UploaderRegistry`, so
    // the ctx must stay alive and the controller must NOT be released yet.
    cleanup();
    const { delay } = await import('@/utils/delay.js');
    await delay(0);

    expect(hasCtx(ctxName)).toBe(true);
    expect(child.isConnected).toBe(true);
    expect(child.releasedCount).toBe(0);
    // biome-ignore lint/suspicious/noExplicitAny: reaching into a protected getter
    expect((child as any).useOrNull(ConfigController)).not.toBeNull();

    // Now the ChildBlock itself disconnects too: nothing references the ctx
    // any more, so its own deferred check tears it down.
    child.remove();
    await expect.poll(() => hasCtx(ctxName)).toBe(false);
    await expect.poll(() => child.releasedCount).toBe(1);
    // biome-ignore lint/suspicious/noExplicitAny: reaching into a protected getter
    expect((child as any).useOrNull(ConfigController)).toBeNull();

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
 * M9o Task 3: unified consumer-refcount teardown. A ctx dies only when BOTH
 * halves release it — `*blocksRegistry` empty/absent (v1 `LitBlock`s) AND
 * `UploaderRegistry.hasConsumers` false (v2 `ChildBlock`s watching via
 * `whenAvailable`). Each `it` below is one named interleaving from the task
 * brief.
 */
describe('mixed lifecycle (v1 blocks + ChildBlock on one ctx)', () => {
  it('(b) v1 disconnects first: last v1 leaving keeps the ctx alive while a ChildBlock still watches it; the ChildBlock leaving then tears it down', async () => {
    const ctxName = getCtxName();
    const { delay } = await import('@/utils/delay.js');

    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const config = page.getByTestId('uc-config').query()!;
    const child = append('test-child-block', { 'ctx-name': ctxName });
    await expect.poll(() => child.readyCount).toBe(1);
    await expect.poll(() => hasCtx(ctxName)).toBe(true);

    // The only v1 block disconnects: `*blocksRegistry` empties, but the
    // ChildBlock is still watching via `UploaderRegistry` — the unified
    // predicate must keep the ctx alive past the deferred destroy-check
    // window.
    config.remove();
    await delay(0);

    expect(hasCtx(ctxName)).toBe(true);
    expect(child.releasedCount).toBe(0);
    // biome-ignore lint/suspicious/noExplicitAny: reaching into a protected getter
    expect((child as any).useOrNull(ConfigController)).not.toBeNull();

    // The ChildBlock leaves too: nothing references the ctx any more, so its
    // own deferred check tears it down.
    child.remove();
    await expect.poll(() => hasCtx(ctxName)).toBe(false);
    expect(child.releasedCount).toBe(1);
  });

  it('(c) ChildBlock disconnects first: the ctx stays alive on the remaining v1 block; that block leaving then tears it down', async () => {
    const ctxName = getCtxName();
    const { delay } = await import('@/utils/delay.js');

    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const config = page.getByTestId('uc-config').query()!;
    const child = append('test-child-block', { 'ctx-name': ctxName });
    await expect.poll(() => child.readyCount).toBe(1);
    await expect.poll(() => hasCtx(ctxName)).toBe(true);

    // The ChildBlock disconnects while the v1 block is still around: its own
    // deferred check must see `*blocksRegistry` non-empty and bail out.
    child.remove();
    await delay(0);

    expect(hasCtx(ctxName)).toBe(true);

    // The last v1 block disconnects: nothing left referencing the ctx.
    config.remove();
    await expect.poll(() => hasCtx(ctxName)).toBe(false);
  });
});

/**
 * M9o Task 3 (d): a v1-free ctx — two `ChildBlock`s self-bootstrap it
 * (M9o Task 2) and no v1 `LitBlock` ever exists in the composition. Teardown
 * must be driven purely by the `UploaderRegistry` consumer refcount.
 */
describe('v1-free lifecycle (ChildBlock-only composition, M9o Task 3d)', () => {
  it('one of two ChildBlocks leaving keeps the ctx alive; the last one leaving tears it down', async () => {
    const ctxName = getCtxName();
    const { delay } = await import('@/utils/delay.js');
    expect(hasCtx(ctxName)).toBe(false);

    const childA = append('test-child-block', { 'ctx-name': ctxName });
    await expect.poll(() => childA.readyCount).toBe(1);
    const childB = append('test-child-block', { 'ctx-name': ctxName });
    await expect.poll(() => childB.readyCount).toBe(1);
    expect(hasCtx(ctxName)).toBe(true);

    childA.remove();
    await delay(0);

    expect(hasCtx(ctxName)).toBe(true);
    expect(childB.releasedCount).toBe(0);

    childB.remove();
    await expect.poll(() => hasCtx(ctxName)).toBe(false);
  });

  it('(e) a lone ChildBlock disconnecting then reconnecting within the same tick does not tear down its self-bootstrapped ctx', async () => {
    const ctxName = getCtxName();
    const { delay } = await import('@/utils/delay.js');
    expect(hasCtx(ctxName)).toBe(false);

    const child = append('test-child-block', { 'ctx-name': ctxName });
    await expect.poll(() => child.readyCount).toBe(1);
    const firstContainer = containerOf(ctxName);

    const parent = child.parentElement!;
    child.remove();
    parent.append(child);

    await delay(0);

    expect(hasCtx(ctxName)).toBe(true);
    expect(containerOf(ctxName)).toBe(firstContainer);
  });

  it('(f) a v1 block and its last ChildBlock disconnecting in the same tick destroy the ctx exactly once, not twice', async () => {
    const ctxName = getCtxName();

    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const config = page.getByTestId('uc-config').query()!;
    const child = append('test-child-block', { 'ctx-name': ctxName });
    await expect.poll(() => child.readyCount).toBe(1);
    await expect.poll(() => hasCtx(ctxName)).toBe(true);

    // M-god step 8e: the ctx's `ControllerContainer` is the teardown unit — its
    // `dispose()` destroys the container-owned controllers. Spy on it to assert
    // the ctx is disposed exactly once (not twice).
    const destroySpy = vi.spyOn(ControllerContainer.prototype, 'dispose');
    destroySpy.mockClear();

    // Both the only v1 block and the only ChildBlock disconnect in the same
    // tick: both schedule a deferred unified-predicate check, and both will
    // find the ctx unreferenced. `UploaderRegistry.dispose`'s own idempotency
    // (the container is removed from the registry map on first dispose) must
    // make the second deferred check's dispose a no-op.
    config.remove();
    child.remove();

    await expect.poll(() => hasCtx(ctxName)).toBe(false);
    // Give any second deferred check a chance to run too.
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(destroySpy).toHaveBeenCalledTimes(1);
    destroySpy.mockRestore();
  });
});
