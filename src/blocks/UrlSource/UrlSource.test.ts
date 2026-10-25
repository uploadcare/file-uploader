import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterController } from '../../abstract/controllers/RouterController';
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

describe('UrlSource', () => {
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
