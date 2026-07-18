import { afterEach, describe, expect, it } from 'vitest';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { PubSub } from '../../lit/PubSubCompat';
import { delay } from '../../utils/delay';
import { PluginActivityRenderer } from './PluginActivityRenderer';

// Idempotent (same path as defineComponents(UC)).
PluginActivityRenderer.reg('uc-plugin-activity-renderer');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `plugin-activity-renderer-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    if (PubSub.hasCtx(name)) PubSub.deleteCtx(name);
  }
});

const mount = async (ctxName: string): Promise<PluginActivityRenderer> => {
  ensureUploaderCtx(ctxName);
  const el = document.createElement('uc-plugin-activity-renderer') as PluginActivityRenderer;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return el;
};

describe('PluginActivityRenderer (M-god step 6b-2 migration)', () => {
  it('declares no container dependencies — its only read (the plugin manager) has no DI token', () => {
    // Documents the migration outcome: there is no config/activity/collection
    // read to move onto use(); the plugin manager stays on the v1 `bag` path.
    expect(PluginActivityRenderer.uses).toEqual([]);
  });

  it('renders an empty activity list when no plugin manager has registered', async () => {
    const el = await mount(freshCtxName());
    await delay(0);
    expect(el.querySelector('uc-plugin-activity-host')).toBeNull();
    expect(el.querySelector('uc-modal')).toBeNull();
  });
});
