import { html } from 'lit';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
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

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [(listener: () => void) => ctrl.config.subscribe(listener)];
  }

  protected override controllerReady(): void {
    this.readyCount += 1;
  }

  protected override controllerReleased(): void {
    this.releasedCount += 1;
  }

  public override render() {
    return html`<span class="pk">${this.uploaderOrNull?.config.get('pubkey') ?? ''}</span>`;
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
    await new Promise((resolve) => setTimeout(resolve, 50));
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

  it('throws a descriptive error when uploader is read before adoption', () => {
    const child = document.createElement('test-child-block');
    // biome-ignore lint/suspicious/noExplicitAny: reaching into a protected getter
    expect(() => (child as any).uploader).toThrowError(/test-child-block/);
  });
});
