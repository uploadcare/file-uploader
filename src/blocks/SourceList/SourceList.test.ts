import { afterEach, describe, expect, it } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
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
    UploaderRegistry.dispose(name);
  }
});

const mount = async (ctxName: string): Promise<{ el: SourceList; config: ConfigController }> => {
  ensureUploaderCtx(ctxName);
  const config = UploaderRegistry.get(ctxName)?.get(ConfigController);
  if (!config) throw new Error('config controller not resolved');
  const el = document.createElement('uc-source-list') as SourceList;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return { el, config };
};

describe('SourceList', () => {
  it('drives the host [nowrap] attribute from the sourceListWrap config resolved via use(ConfigController)', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mount(ctxName);

    // Default sourceListWrap is true -> no `[nowrap]` (the stylesheet's `display: contents` hook).
    expect(el.hasAttribute('nowrap')).toBe(false);

    config.set('sourceListWrap', false);
    // `updated()` reads the value on the next render; force one and let it settle.
    el.requestUpdate();
    await el.updateComplete;
    await delay(0);
    expect(el.hasAttribute('nowrap')).toBe(true);

    config.set('sourceListWrap', true);
    el.requestUpdate();
    await el.updateComplete;
    await delay(0);
    expect(el.hasAttribute('nowrap')).toBe(false);
  });

  it("leaves the consumer's inline display alone on every update", async () => {
    const { el, config } = await mount(freshCtxName());
    el.style.display = 'grid';

    for (const wrap of [false, true]) {
      config.set('sourceListWrap', wrap);
      el.requestUpdate();
      await el.updateComplete;
      expect(el.style.display).toBe('grid');
    }
  });
});
