import { afterEach, describe, expect, it } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { PubSub } from '../../lit/PubSubCompat';
import { delay } from '../../utils/delay';
import { SourceList } from './SourceList';

// Idempotent (same path as defineComponents(UC)).
SourceList.reg('uc-source-list');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `source-list-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    if (PubSub.hasCtx(name)) PubSub.deleteCtx(name);
  }
});

const mount = async (ctxName: string): Promise<{ el: SourceList; config: ConfigController }> => {
  ensureUploaderCtx(ctxName);
  const config = PubSub.getContainer(ctxName)?.get(ConfigController);
  if (!config) throw new Error('config controller not resolved');
  const el = document.createElement('uc-source-list') as SourceList;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return { el, config };
};

describe('SourceList (M-god step 6b-3 migration)', () => {
  it('declares its dependency via static uses', () => {
    expect(SourceList.uses).toEqual([ConfigController]);
  });

  it('drives the host display style from the sourceListWrap config resolved via use(ConfigController)', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mount(ctxName);

    // Default sourceListWrap is true -> no inline `display: contents`.
    expect(el.style.display).toBe('');

    config.set('sourceListWrap', false);
    // `updated()` reads the value on the next render; force one and let it settle.
    el.requestUpdate();
    await el.updateComplete;
    await delay(0);
    expect(el.style.display).toBe('contents');

    config.set('sourceListWrap', true);
    el.requestUpdate();
    await el.updateComplete;
    await delay(0);
    expect(el.style.display).toBe('');
  });
});
