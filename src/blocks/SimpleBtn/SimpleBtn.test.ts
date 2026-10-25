import { afterEach, describe, expect, it } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { LocaleController } from '../../abstract/controllers/LocaleController';
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

describe('SimpleBtn', () => {
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

  it('turns its dropzone off with dropzone="false"', async () => {
    const { el } = await mountWithConfig(freshCtxName());
    expect(el.querySelector('uc-drop-area')?.disabled).toBe(false);

    el.setAttribute('dropzone', 'false');
    await el.updateComplete;
    expect(el.dropzone).toBe(false);
    expect(el.querySelector('uc-drop-area')?.disabled).toBe(true);
  });
});
