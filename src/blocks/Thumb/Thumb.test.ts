import { afterEach, describe, expect, it } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { PubSub } from '../../lit/PubSubCompat';
import { delay } from '../../utils/delay';
import { Thumb } from './Thumb';

// Idempotent (same path as defineComponents(UC)).
Thumb.reg('uc-thumb');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `thumb-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    if (PubSub.hasCtx(name)) PubSub.deleteCtx(name);
  }
});

const mount = async (ctxName: string): Promise<{ el: Thumb; config: ConfigController }> => {
  ensureUploaderCtx(ctxName);
  const config = PubSub.getContainer(ctxName)?.get(ConfigController);
  if (!config) throw new Error('config controller not resolved');
  const el = document.createElement('uc-thumb') as Thumb;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  await delay(0);
  return { el, config };
};

const badgeIconName = (el: Thumb): string | null => el.querySelector('.uc-badge uc-icon')?.getAttribute('name') ?? null;

describe('Thumb (M-god step 6b-6 migration)', () => {
  it('declares its dependencies via static uses', () => {
    expect(Thumb.uses).toEqual([ConfigController, TelemetryManager]);
  });

  it('pre-warms its declared dependencies into the container on adoption', async () => {
    const ctxName = freshCtxName();
    await mount(ctxName);
    const container = PubSub.getContainer(ctxName);
    expect(container?.get(ConfigController)).toBeInstanceOf(ConfigController);
    expect(container?.get(TelemetryManager)).toBeInstanceOf(TelemetryManager);
  });

  it('adopts the controller (reading filesViewMode via use(ConfigController)) without throwing in grid mode', async () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    // Seed grid mode before mount so controllerReady's `_firstViewMode` init reads
    // it through `use(ConfigController).get('filesViewMode')`.
    PubSub.getContainer(ctxName)?.get(ConfigController).set('filesViewMode', 'grid');
    const { el } = await mount(ctxName);
    expect(el.isConnected).toBe(true);
    expect(el.querySelector('.uc-thumb')).not.toBeNull();
  });

  it('renders the badge icon from the badgeIcon property', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    el.badgeIcon = 'badge-success';
    await el.updateComplete;
    await delay(0);
    expect(badgeIconName(el)).toBe('badge-success');
  });
});
