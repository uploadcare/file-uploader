import { html } from 'lit';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { RouterController } from '@/abstract/controllers/RouterController';
import type { ControllerContainer } from '@/abstract/di/ControllerContainer';
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

class TestDynamicActivityBlock extends ActivityChildBlock {
  public override activityType: ActivityChildBlock['activityType'] = 'start-from';

  /** Test-only hook mirroring `PluginActivityHost`'s late-sync path. */
  public changeActivityType(next: ActivityChildBlock['activityType']): void {
    this.activityType = next;
    this.reportActivityMounted();
  }

  public override render() {
    return html`<span class="marker">dynamic</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'test-activity-block': TestActivityBlock;
    'test-no-activity-block': TestNoActivityBlock;
    'test-dynamic-activity-block': TestDynamicActivityBlock;
  }
}

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
  if (!customElements.get('test-activity-block')) customElements.define('test-activity-block', TestActivityBlock);
  if (!customElements.get('test-no-activity-block')) {
    customElements.define('test-no-activity-block', TestNoActivityBlock);
  }
  if (!customElements.get('test-dynamic-activity-block')) {
    customElements.define('test-dynamic-activity-block', TestDynamicActivityBlock);
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

const routerOf = (block: ChildBlock): RouterController =>
  (block as unknown as { container: ControllerContainer }).container.get(RouterController);

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

  it('re-reports the mounted-activity signal (old id un-reported, new id reported) when activityType changes dynamically', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const child = append('test-dynamic-activity-block', { 'ctx-name': ctxName });
    await expect.poll(() => child.getAttribute('activity')).toBe('start-from');

    const router = routerOf(child);
    expect(router.hasMountedActivity('start-from')).toBe(true);
    expect(router.hasMountedActivity('camera')).toBe(false);

    child.changeActivityType('camera');

    expect(router.hasMountedActivity('start-from')).toBe(false);
    expect(router.hasMountedActivity('camera')).toBe(true);
  });
});
