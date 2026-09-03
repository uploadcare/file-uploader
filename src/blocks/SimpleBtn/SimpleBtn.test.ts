import { afterEach, describe, expect, it } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { LocaleController } from '../../abstract/controllers/LocaleController';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
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
    UploaderRegistry.dispose(name);
  }
});

const mountWithConfig = async (ctxName: string): Promise<{ el: SimpleBtn; config: ConfigController }> => {
  ensureUploaderCtx(ctxName);
  const config = UploaderRegistry.get(ctxName)?.get(ConfigController);
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
  it('resolves its ConfigController + UploaderPublicApi dependencies via @inject fields on the element', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mountWithConfig(ctxName);
    const api = UploaderRegistry.get(ctxName)?.get(UploaderPublicApi);
    expect(api).toBeDefined();

    // The `@inject` fields resolve through the container the block adopted
    // (tagged as `this[CONTAINER]`), yielding the very same instances the ctx
    // owns — the mechanism that replaces `static uses` + `this.use()`.
    const injected = el as unknown as { _config: ConfigController; _api: UploaderPublicApi };
    expect(injected._config).toBe(config);
    expect(injected._api).toBe(api);
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

  it('re-renders the button text reactively on a locale change with no explicit subscription (l10n getTracked)', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mountWithConfig(ctxName);

    // Pin the single-file key so the locale key under test (`upload-file`) is
    // the one actually rendered, regardless of the `multiple` default.
    config.set('multiple', false);
    await el.updateComplete;
    await delay(0);

    // Default English dictionary value, resolved through `this.l10n('upload-file')`.
    expect(buttonText(el)).toBe('Upload file');

    // This block declares no `subscriptionsFor` override (removed — M-god step
    // 9e-3): `createL10n` now reads `LocaleController.getTracked`, so the
    // `l10n('upload-file')` call inside `render()` auto-tracks that key under
    // `SignalWatcher` on its own. Writing the key directly on the controller
    // (bypassing any block-level subscription) must still re-render the block.
    const locale = UploaderRegistry.get(ctxName)?.get(LocaleController);
    if (!locale) throw new Error('locale controller not resolved');
    locale.set('upload-file', 'CUSTOM');
    await el.updateComplete;
    await delay(0);

    expect(buttonText(el)).toBe('CUSTOM');
  });
});
