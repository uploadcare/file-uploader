import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterController } from '../../abstract/controllers/RouterController';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { UrlSource } from './UrlSource';

// Idempotent (same path as defineComponents(UC)).
UrlSource.reg('uc-url-source');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `url-source-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  vi.restoreAllMocks();
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    UploaderRegistry.dispose(name);
  }
});

const mount = async (ctxName: string): Promise<UrlSource> => {
  const el = document.createElement('uc-url-source') as UrlSource;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return el;
};

describe('UrlSource (M-god step 6b-1 migration)', () => {
  it('resolves its TelemetryManager + RouterController + UploaderPublicApi dependencies via @inject fields', async () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    const container = UploaderRegistry.get(ctxName);
    expect(container).toBeDefined();

    const el = await mount(ctxName);
    // The `@inject` fields resolve through the container the block adopted
    // (tagged as `this[CONTAINER]`), yielding the very same instances the ctx
    // owns — the mechanism that replaces `static uses` + `this.use()`.
    const injected = el as unknown as {
      _telemetry: TelemetryManager;
      _router: RouterController;
      _api: UploaderPublicApi;
    };
    expect(injected._telemetry).toBe(container?.get(TelemetryManager));
    expect(injected._router).toBe(container?.get(RouterController));
    expect(injected._api).toBe(container?.get(UploaderPublicApi));
  });

  it('routes header back/close navigation through the container-resolved RouterController (use())', async () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    const router = UploaderRegistry.get(ctxName)!.get(RouterController);
    const spy = vi.spyOn(router, 'traverse').mockImplementation(() => {});

    const el = await mount(ctxName);
    await el.updateComplete;

    const backBtn = el.querySelector<HTMLButtonElement>('.uc-mini-btn:not(.uc-close-btn)');
    const closeBtn = el.querySelector<HTMLButtonElement>('.uc-close-btn');
    expect(backBtn).toBeTruthy();
    expect(closeBtn).toBeTruthy();

    backBtn!.click();
    expect(spy).toHaveBeenCalledWith('onBack');

    closeBtn!.click();
    expect(spy).toHaveBeenCalledWith('onClose');
  });
});
