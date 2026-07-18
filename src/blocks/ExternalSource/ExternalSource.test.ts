import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { PubSub } from '../../lit/PubSubCompat';
import { ExternalSource } from './ExternalSource';

// Idempotent (same path as defineComponents(UC)).
ExternalSource.reg('uc-external-source');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `external-source-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  vi.restoreAllMocks();
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    if (PubSub.hasCtx(name)) PubSub.deleteCtx(name);
  }
});

const mount = async (ctxName: string): Promise<{ el: ExternalSource; router: RouterController }> => {
  ensureUploaderCtx(ctxName);
  const router = PubSub.getContainer(ctxName)?.get(RouterController);
  if (!router) throw new Error('router controller not resolved');
  const el = document.createElement('uc-external-source') as ExternalSource;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return { el, router };
};

describe('ExternalSource (M-god step 6b-2 migration)', () => {
  it('declares its dependencies via static uses', () => {
    expect(ExternalSource.uses).toEqual([ConfigController, RouterController, UploaderPublicApi]);
  });

  it('routes the close button through the container-resolved RouterController (use())', async () => {
    // The deferred mount in controllerReady reads router params for the (absent)
    // externalSourceType and console.errors then bails — silence it here so the
    // test asserts only the close-button routing.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctxName = freshCtxName();
    const { el, router } = await mount(ctxName);
    const spy = vi.spyOn(router, 'traverse').mockImplementation(() => {});

    (el.querySelector('.uc-close-btn') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledWith('onClose');
  });
});
