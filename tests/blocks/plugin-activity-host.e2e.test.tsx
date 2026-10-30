import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { RouterController } from '@/abstract/controllers/RouterController';
import type { PluginActivityHost } from '@/index.ts';
import { getCtxName } from '../utils/getCtxName';
import { containerOf } from '../utils/registry';
import '../../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

const appended: HTMLElement[] = [];
const append = (ctxName: string): PluginActivityHost => {
  const el = document.createElement('uc-plugin-activity-host') as PluginActivityHost;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  appended.push(el);
  return el;
};

afterEach(() => {
  for (const el of appended) el.remove();
  appended.length = 0;
});

const routerOf = (ctxName: string): RouterController => containerOf(ctxName).get(RouterController);

describe('PluginActivityHost — dynamic registration (gap-fill ahead of ChildBlock port)', () => {
  it('stays inert (no activity attribute, no [active]) when created without a registration', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const host = append(ctxName);
    await host.updateComplete;

    expect(host.hasAttribute('activity')).toBe(false);
    expect(host.hasAttribute('active')).toBe(false);
  });

  it('syncs the activity attribute and mounts the plugin render() when a registration arrives after the host is already connected', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const host = append(ctxName);
    await host.updateComplete;

    const router = routerOf(ctxName);
    // The activity is already current before the registration is known. The
    // Renderer's keyed `repeat()` only ever creates hosts with `.registration`
    // already set, so nothing else covers a host that gets it later.
    router.setActivity('late-activity');

    let renderedEl: HTMLElement | undefined;
    host.registration = {
      id: 'late-activity',
      pluginId: 'late-plugin',
      render: (el: HTMLElement) => {
        renderedEl = el;
        el.textContent = 'late content';
        return () => {
          el.replaceChildren();
        };
      },
    };

    await expect.poll(() => host.getAttribute('activity')).toBe('late-activity');
    await expect.poll(() => renderedEl?.textContent).toBe('late content');
    expect(host.hasAttribute('active')).toBe(true);
    expect(router.hasMountedActivity('late-activity')).toBe(true);

    // Regression: a host that adopted before its `.registration` arrived must
    // still re-render on navigation, even though `activityType` was null at
    // adoption time. Otherwise navigating away never unmounts the plugin and
    // its content stays mounted forever.
    router.setActivity(null);
    await expect.poll(() => renderedEl?.textContent).toBe('');
    expect(host.hasAttribute('active')).toBe(false);
  });
});

declare module '@/types/index' {
  interface CustomActivities {
    'late-activity': { params: never };
  }
}
