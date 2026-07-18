import { afterEach, describe, expect, it } from 'vitest';
import { CollectionStateController } from '../../abstract/controllers/CollectionStateController';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { PubSub } from '../../lit/PubSubCompat';
import { delay } from '../../utils/delay';
import { DynamicBtn } from './DynamicBtn';

// Idempotent (same path as defineComponents(UC)).
DynamicBtn.reg('uc-dynamic-btn');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `dynamic-btn-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    if (PubSub.hasCtx(name)) PubSub.deleteCtx(name);
  }
});

const mountWithConfig = async (ctxName: string): Promise<{ el: DynamicBtn; config: ConfigController }> => {
  ensureUploaderCtx(ctxName);
  const config = PubSub.getContainer(ctxName)?.get(ConfigController);
  if (!config) throw new Error('config controller not resolved');
  const el = document.createElement('uc-dynamic-btn') as DynamicBtn;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return { el, config };
};

const hasPrimaryAction = (el: DynamicBtn): boolean => el.querySelector('uc-primary-action') !== null;

describe('DynamicBtn (M-god step 6b-2 migration)', () => {
  it('declares its dependencies via static uses', () => {
    expect(DynamicBtn.uses).toEqual([ConfigController, RouterController, CollectionStateController]);
  });

  it('re-renders reactively when config.dynamicButtonViewMode changes (getTracked, no subConfigValue)', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mountWithConfig(ctxName);

    // Idle, no entries: `auto` mode always shows the primary action; `compact`
    // mode never does. Switching the config re-renders through the tracked
    // `_mode` read with no imperative `subConfigValue` subscription.
    config.set('dynamicButtonViewMode', 'auto');
    await el.updateComplete;
    await delay(0);
    expect(hasPrimaryAction(el)).toBe(true);

    config.set('dynamicButtonViewMode', 'compact');
    await el.updateComplete;
    await delay(0);
    expect(hasPrimaryAction(el)).toBe(false);

    // Bidirectional.
    config.set('dynamicButtonViewMode', 'auto');
    await el.updateComplete;
    await delay(0);
    expect(hasPrimaryAction(el)).toBe(true);
  });
});
