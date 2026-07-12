import { html } from 'lit';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { RouterController } from '@/abstract/controllers/RouterController';
import { ActivityChildBlock } from '@/lit/ActivityChildBlock';
import type { ChildBlock } from '@/lit/ChildBlock';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

class TestActivityBlock extends ActivityChildBlock {
  public override activityType: ActivityChildBlock['activityType'] = 'start-from';

  public override render() {
    return html`<span class="marker">activity</span>`;
  }
}

class TestNoActivityBlock extends ActivityChildBlock {
  public override render() {
    return html`<span class="marker">no-activity</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'test-activity-block': TestActivityBlock;
    'test-no-activity-block': TestNoActivityBlock;
  }
}

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
  if (!customElements.get('test-activity-block')) customElements.define('test-activity-block', TestActivityBlock);
  if (!customElements.get('test-no-activity-block')) {
    customElements.define('test-no-activity-block', TestNoActivityBlock);
  }
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

// biome-ignore lint/suspicious/noExplicitAny: reaching into the protected `bag` to drive the router directly, same pattern as child-block.e2e.test.tsx
const routerOf = (block: ChildBlock): RouterController => (block as any).bag.router;

describe('ActivityChildBlock', () => {
  it('sets the activity attribute on adoption', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const child = append('test-activity-block', { 'ctx-name': ctxName });

    await expect.poll(() => child.getAttribute('activity')).toBe('start-from');
  });

  it('toggles [active] as the router background activity moves to/from its activityType', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const child = append('test-activity-block', { 'ctx-name': ctxName });
    await expect.poll(() => child.getAttribute('activity')).toBe('start-from');

    const router = routerOf(child);
    expect(child.hasAttribute('active')).toBe(false);

    router.setActivity('start-from');
    await expect.poll(() => child.hasAttribute('active')).toBe(true);

    router.setActivity(null);
    await expect.poll(() => child.hasAttribute('active')).toBe(false);
  });

  it('does not set activity or active for blocks without an activityType', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const child = append('test-no-activity-block', { 'ctx-name': ctxName });
    await child.updateComplete;

    const router = routerOf(child);
    router.setActivity('start-from');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(child.hasAttribute('activity')).toBe(false);
    expect(child.hasAttribute('active')).toBe(false);
  });

  it('tracks the foreground modal slot instead of the background slot when nested in a uc-modal', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const modal = append('uc-modal', { 'ctx-name': ctxName });
    const child = document.createElement('test-activity-block');
    child.setAttribute('ctx-name', ctxName);
    modal.append(child);

    await expect.poll(() => child.getAttribute('activity')).toBe('start-from');

    const router = routerOf(child);

    // Background activity alone must not activate a modal-nested block.
    router.setActivity('start-from');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(child.hasAttribute('active')).toBe(false);

    router.openModal('start-from');
    await expect.poll(() => child.hasAttribute('active')).toBe(true);

    router.closeModal();
    await expect.poll(() => child.hasAttribute('active')).toBe(false);
  });

  it('subActivity fires immediately, dedupes notifications that leave the effective activity unchanged, and fires on a real change', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const child = append('test-activity-block', { 'ctx-name': ctxName });
    await expect.poll(() => child.getAttribute('activity')).toBe('start-from');

    const router = routerOf(child);
    const seen: unknown[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: reaching into the protected `subActivity` helper, same pattern as subConfigValue in child-block.e2e.test.tsx
    (child as any).subActivity((activity: unknown) => seen.push(activity));
    expect(seen).toEqual([null]); // fires immediately with the current (background-less) activity

    router.setActivity('start-from');
    await expect.poll(() => seen.length).toBe(2);
    expect(seen).toEqual([null, 'start-from']);

    // Re-setting the same background activity still notifies subscribers
    // (RouterController.setActivity always calls _transition), but the
    // *effective* activity is unchanged — subActivity must not re-fire.
    router.setActivity('start-from');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(seen).toEqual([null, 'start-from']);

    router.openModal('camera');
    await expect.poll(() => seen.length).toBe(3);
    expect(seen).toEqual([null, 'start-from', 'camera']);
  });
});
