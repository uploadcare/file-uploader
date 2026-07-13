import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { RouterController } from '@/abstract/controllers/RouterController';
import type { PluginActivityHost } from '@/index.ts';
import { getCtxName } from '../utils/getCtxName';
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

const routerOf = (host: PluginActivityHost): RouterController => host.router;

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

    const router = routerOf(host);
    // The activity is already current before the registration is known — this
    // is the scenario `updated()`'s "Keep activityType in sync if the
    // registration arrives/changes late" comment guards: nothing in the
    // existing plugin nets constructs a host that starts registration-less
    // and only later receives its `.registration` (the Renderer's keyed
    // `repeat()` only ever creates hosts with `.registration` already
    // populated). We only pin what's observably correct today — the `activity`
    // attribute sync and the plugin's render() being invoked — not the
    // `[active]` attribute, whose reflection races the activityType update
    // within the same `updated()` pass (a pre-existing v1 quirk the Task 2
    // re-report redesign is expected to address, not preserve).
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

    // Regression: a host that adopted before its `.registration` arrived must
    // still have a router subscription wired (`subRouter` in
    // `ActivityChildBlock.controllerReady`), even though `activityType` was
    // null at adoption time. Otherwise, once the late registration mounts the
    // plugin, navigating away never re-renders the host and the plugin content
    // stays mounted forever.
    router.setActivity(null);
    await expect.poll(() => renderedEl?.textContent).toBe('');
  });
});

declare module '@/types/index' {
  interface CustomActivities {
    'late-activity': { params: never };
  }
}
