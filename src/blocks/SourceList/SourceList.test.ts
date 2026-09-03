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

describe('SourceList (M-god step 6b-3 migration)', () => {
  it('resolves its ConfigController dependency via the @inject field on the element', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mount(ctxName);
    // The `@inject(ConfigController)` field resolves through the container the
    // block adopted (tagged as `this[CONTAINER]`), yielding the very same
    // controller instance the ctx owns — the mechanism that replaces
    // `static uses` + `this.use()`.
    expect((el as unknown as { _config: ConfigController })._config).toBe(config);
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
