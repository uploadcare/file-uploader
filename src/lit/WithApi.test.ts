import { afterEach, describe, expect, it } from 'vitest';
import { EventBus } from '../abstract/EventBus';
import { UploaderRegistry } from '../abstract/UploaderRegistry';
import { delay } from '../utils/delay';
import { ChildBlock } from './ChildBlock';
import { ensureUploaderCtx } from './ensureUploaderCtx';
import { WithApi } from './WithApi';

class ApiHostProbe extends WithApi(ChildBlock) {}
ApiHostProbe.reg('uc-api-host-probe');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `withapi-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) UploaderRegistry.dispose(name);
});

const mount = async (ctxName: string): Promise<ApiHostProbe> => {
  ensureUploaderCtx(ctxName);
  const el = document.createElement('uc-api-host-probe') as ApiHostProbe;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  await delay(0);
  return el;
};

describe('WithApi (block-agnostic API / events host)', () => {
  it('exposes getAPI() / .api / .uploadCollection after adoption', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);
    const api = el.getAPI();
    expect(api).toBeTruthy();
    expect(el.api).toBe(api);
    expect(typeof api.addFileFromObject).toBe('function');
    expect(el.uploadCollection).toBeTruthy();
  });

  it('bridges EventBus events as CustomEvents on a non-ctx-provider host', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);
    const bus = UploaderRegistry.get(ctxName)?.get(EventBus);
    if (!bus) throw new Error('EventBus missing');

    const received: CustomEvent[] = [];
    el.addEventListener('file-added', (e) => received.push(e as CustomEvent));

    const payload = { internalId: 'probe' } as never;
    bus.emit('file-added', payload);

    expect(received).toHaveLength(1);
    expect(received[0]?.detail).toBe(payload);
  });

  it('stops bridging after disconnect (subscription auto-disposed)', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);
    const bus = UploaderRegistry.get(ctxName)?.get(EventBus);
    if (!bus) throw new Error('EventBus missing');

    const received: CustomEvent[] = [];
    el.addEventListener('file-removed', (e) => received.push(e as CustomEvent));

    el.remove();
    await delay(0);
    bus.emit('file-removed', {} as never);

    expect(received).toHaveLength(0);
  });
});
