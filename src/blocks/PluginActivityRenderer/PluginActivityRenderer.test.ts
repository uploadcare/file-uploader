import { afterEach, describe, expect, it } from 'vitest';
import { PluginController } from '../../abstract/managers/plugin';
import { PluginRegistry } from '../../abstract/managers/plugin/PluginRegistry';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
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
    UploaderRegistry.dispose(name);
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
  // `PluginActivityRenderer` has no always-bound `@inject` field: its only
  // controller read is the conditionally-bound `PluginController`, resolved via
  // the now-or-when-available `whenController(PluginController)` (M-god step
  // 9b-2), since that token is only bound once an uploader scope attaches (or
  // never, in a bare ctx). That behavior is covered by the two specs below.
  it('renders an empty activity list when no plugin manager has registered', async () => {
    const el = await mount(freshCtxName());
    await delay(0);
    expect(el.querySelector('uc-plugin-activity-host')).toBeNull();
    expect(el.querySelector('uc-modal')).toBeNull();
  });

  it('renders plugin activities once the PluginController resolves on the container (whenController)', async () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    const container = UploaderRegistry.get(ctxName);
    if (!container) throw new Error('container not resolved');

    const registry = new PluginRegistry(() => {});
    registry.addActivity('test-plugin', { id: 'my-activity', render: () => undefined });
    const fakePluginManager = {
      snapshot: () => registry.snapshot(),
      onPluginsChange: () => () => {},
    } as unknown as PluginController;
    container.bind(PluginController, () => fakePluginManager);

    const el = document.createElement('uc-plugin-activity-renderer') as PluginActivityRenderer;
    el.setAttribute('ctx-name', ctxName);
    el.mode = 'inline';
    document.body.append(el);
    mounted.push(el);
    await el.updateComplete;

    // whenController is pending — the token is bound but not resolved yet.
    expect(el.querySelector('uc-plugin-activity-host')).toBeNull();

    // Resolving it (mirrors `ensurePluginManager`) flushes the waiter, which
    // syncs activities and renders one host for the registered activity.
    container.get(PluginController);
    await el.updateComplete;
    await delay(0);
    expect(el.querySelector('uc-plugin-activity-host')).not.toBeNull();
  });
});
