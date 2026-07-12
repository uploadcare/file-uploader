import { html } from 'lit';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { UploaderController } from '@/abstract/controllers/UploaderController';
import type { Config } from '@/index.ts';
import { ChildBlock } from '@/lit/ChildBlock';
import { LitBlock } from '@/lit/LitBlock';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

class TestChildBlock extends ChildBlock {
  public static override styleAttrs = ['test-child-style'];
  public readyCount = 0;
  public releasedCount = 0;
  public throwOnRelease = false;
  public throwInReady = false;
  public cleanupRanAfterThrow = false;

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
});
