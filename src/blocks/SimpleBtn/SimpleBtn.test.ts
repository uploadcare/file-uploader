import { afterEach, describe, expect, it } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { PubSub } from '../../lit/PubSubCompat';
import { delay } from '../../utils/delay';
import { SimpleBtn } from './SimpleBtn';

// Idempotent (same path as defineComponents(UC)).
SimpleBtn.reg('uc-simple-btn');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `simple-btn-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    if (PubSub.hasCtx(name)) PubSub.deleteCtx(name);
  }
});

const mountWithConfig = async (ctxName: string): Promise<{ el: SimpleBtn; config: ConfigController }> => {
  ensureUploaderCtx(ctxName);
  const config = PubSub.getContainer(ctxName)?.get(ConfigController);
  if (!config) throw new Error('config controller not resolved');
  const el = document.createElement('uc-simple-btn') as SimpleBtn;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return { el, config };
};

const buttonText = (el: SimpleBtn): string | null | undefined => el.querySelector('button span')?.textContent?.trim();

describe('SimpleBtn (M-god step 6b-1 migration)', () => {
  it('declares its dependency via static uses', () => {
    expect(SimpleBtn.uses).toEqual([ConfigController]);
  });

  it('re-renders the button text reactively when config.multiple changes (getTracked, no subConfigValue)', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mountWithConfig(ctxName);
    config.set('multiple', true);
    await el.updateComplete;
    await delay(0);
    const multiText = buttonText(el);
    expect(multiText).toBeTruthy();

    // External config change — no imperative subscription on the block.
    // SignalWatcher tracked the `multiple` read during render(), so this
    // re-renders with the single-file text key.
    config.set('multiple', false);
    await el.updateComplete;
    await delay(0);
    const singleText = buttonText(el);

    expect(singleText).toBeTruthy();
    expect(singleText).not.toBe(multiText);

    // And back again — reactivity is bidirectional.
    config.set('multiple', true);
    await el.updateComplete;
    await delay(0);
    expect(buttonText(el)).toBe(multiText);
  });
});
