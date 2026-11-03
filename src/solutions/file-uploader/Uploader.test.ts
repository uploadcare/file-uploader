import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../abstract/EventBus';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { delay } from '../../utils/delay';
import { Uploader } from './Uploader';

// Side-effect imports register the nested solutions (defineComponents path).
import './regular/FileUploaderRegular';
import './minimal/FileUploaderMinimal';
import './inline/FileUploaderInline';
import { FileUploaderInline } from './inline/FileUploaderInline';
import { FileUploaderMinimal } from './minimal/FileUploaderMinimal';
import { FileUploaderRegular } from './regular/FileUploaderRegular';

Uploader.reg('uc-uploader');
FileUploaderRegular.reg('uc-file-uploader-regular');
FileUploaderMinimal.reg('uc-file-uploader-minimal');
FileUploaderInline.reg('uc-file-uploader-inline');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `uc-uploader-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    UploaderRegistry.dispose(name);
  }
  vi.restoreAllMocks();
});

const mount = async (attrs: Record<string, string> = {}): Promise<{ el: Uploader; ctxName: string }> => {
  const el = document.createElement('uc-uploader') as Uploader;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  // Capture ctx-name after connectedCallback may auto-mint one.
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  await delay(0);
  await delay(0); // nested solution adoption
  const ctxName = el.getAttribute('ctx-name') ?? el.ctxName ?? '';
  if (ctxName) ctxNames.push(ctxName);
  return { el, ctxName };
};

describe('Uploader (unified <uc-uploader>)', () => {
  it('auto-mints a ctx-name when none is provided', async () => {
    const { el, ctxName } = await mount({ mode: 'regular', pubkey: 'demopublickey' });
    expect(ctxName).toMatch(/^uc-uploader-/);
    expect(el.getAttribute('ctx-name')).toBe(ctxName);
    expect(UploaderRegistry.get(ctxName)).toBeTruthy();
  });

  it('defaults to regular mode and renders uc-file-uploader-regular', async () => {
    const { el } = await mount({ 'ctx-name': freshCtxName(), pubkey: 'k' });
    expect(el.mode).toBe('regular');
    expect(el.querySelector('uc-file-uploader-regular')).not.toBeNull();
    expect(el.querySelector('uc-file-uploader-minimal')).toBeNull();
    expect(el.querySelector('uc-file-uploader-inline')).toBeNull();
  });

  it('renders minimal and inline solutions for those modes', async () => {
    const min = await mount({ 'ctx-name': freshCtxName(), mode: 'minimal', pubkey: 'k' });
    expect(min.el.mode).toBe('minimal');
    expect(min.el.querySelector('uc-file-uploader-minimal')).not.toBeNull();
    expect(min.el.querySelector('uc-file-uploader-regular')).toBeNull();

    const inline = await mount({ 'ctx-name': freshCtxName(), mode: 'inline', pubkey: 'k' });
    expect(inline.el.mode).toBe('inline');
    expect(inline.el.querySelector('uc-file-uploader-inline')).not.toBeNull();
    expect(inline.el.querySelector('uc-file-uploader-regular')).toBeNull();
  });

  it('switches the nested solution when mode changes', async () => {
    const { el } = await mount({ 'ctx-name': freshCtxName(), mode: 'regular', pubkey: 'k' });
    expect(el.querySelector('uc-file-uploader-regular')).not.toBeNull();

    el.mode = 'inline';
    await el.updateComplete;
    await delay(0);

    expect(el.querySelector('uc-file-uploader-regular')).toBeNull();
    expect(el.querySelector('uc-file-uploader-inline')).not.toBeNull();
  });

  it('hosts config on the element (WithConfig)', async () => {
    const { el } = await mount({ 'ctx-name': freshCtxName(), pubkey: 'from-attr' });
    expect(el.pubkey).toBe('from-attr');

    el.multiple = true;
    await delay(0);
    expect(el.multiple).toBe(true);
    expect(el.getAttribute('multiple')).toBe('true');
  });

  it('exposes getAPI() / .api once adopted (ctx-provider parity)', async () => {
    const { el } = await mount({ 'ctx-name': freshCtxName(), pubkey: 'k' });
    const api = el.getAPI();
    expect(api).toBeTruthy();
    expect(el.api).toBe(api);
    expect(typeof api.addFileFromObject).toBe('function');
  });

  it('bridges EventBus events as CustomEvents on the host', async () => {
    const { el, ctxName } = await mount({ 'ctx-name': freshCtxName(), pubkey: 'k' });
    const bus = UploaderRegistry.get(ctxName)?.get(EventBus);
    if (!bus) throw new Error('EventBus missing');

    const received: CustomEvent[] = [];
    el.addEventListener('file-added', (e) => received.push(e as CustomEvent));

    const payload = { internalId: 'x' } as never;
    bus.emit('file-added', payload);

    expect(received).toHaveLength(1);
    expect(received[0]?.detail).toBe(payload);
  });

  it('forwards headless and dynamic-button to the regular solution', async () => {
    const { el } = await mount({
      'ctx-name': freshCtxName(),
      mode: 'regular',
      headless: '',
      pubkey: 'k',
    });
    const nested = el.querySelector('uc-file-uploader-regular') as FileUploaderRegular | null;
    expect(nested).not.toBeNull();
    expect(nested?.headless).toBe(true);
    expect(nested?.querySelector('uc-simple-btn')).toBeNull();
  });
});
