import { afterEach, describe, expect, it } from 'vitest';
import { EventBus } from '../../abstract/EventBus';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { delay } from '../../utils/delay';
import { UploadCtxProvider } from './UploadCtxProvider';

// Idempotent (same path as defineComponents(UC)).
UploadCtxProvider.reg('uc-upload-ctx-provider');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `ucp-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    UploaderRegistry.dispose(name);
  }
});

const mount = async (ctxName: string): Promise<{ el: UploadCtxProvider; bus: EventBus }> => {
  ensureUploaderCtx(ctxName);
  const container = UploaderRegistry.get(ctxName);
  const bus = container?.get(EventBus);
  if (!bus) throw new Error('EventBus not resolved');
  const el = document.createElement('uc-upload-ctx-provider') as UploadCtxProvider;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return { el, bus };
};

// The `@subscription() _bridgeBusToDom` replaces the former reactive
// `EventBridgeController`: it re-dispatches every per-ctx `EventBus` event as a
// DOM `CustomEvent` on the host, wired at adoption and auto-disposed on release.
describe('UploadCtxProvider bus → DOM bridge', () => {
  it('dispatches bus events as CustomEvents on the host (type + detail)', async () => {
    const ctxName = freshCtxName();
    const { el, bus } = await mount(ctxName);

    const received: CustomEvent[] = [];
    el.addEventListener('file-added', (e) => received.push(e as CustomEvent));

    const payload = { internalId: 'a' } as never;
    bus.emit('file-added', payload);

    expect(received).toHaveLength(1);
    expect(received[0]?.type).toBe('file-added');
    expect(received[0]?.detail).toBe(payload);
  });

  it('stops dispatching after the element disconnects (subscription auto-disposed)', async () => {
    const ctxName = freshCtxName();
    const { el, bus } = await mount(ctxName);

    const received: CustomEvent[] = [];
    el.addEventListener('file-removed', (e) => received.push(e as CustomEvent));

    el.remove(); // synchronous _releaseController drains the subscription
    await delay(0);
    bus.emit('file-removed', {} as never);

    expect(received).toHaveLength(0);
  });
});
