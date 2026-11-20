import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import type { Uid } from '../../abstract/Uid';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { Thumb } from './Thumb';

const mocks = vi.hoisted(() => ({
  generateThumb: vi.fn<(file: File, size?: number) => string | Promise<string>>(),
  cdnLoads: true,
}));

vi.mock('../../utils/resizeImage', () => ({ generateThumb: mocks.generateThumb }));
vi.mock('../../utils/preloadImage', () => ({
  preloadImage: (src: string) => ({
    promise:
      src.startsWith('https://') && !mocks.cdnLoads ? Promise.reject(new Error('cdn down')) : new Promise(() => {}),
    image: new Image(),
    cancel: () => {},
  }),
}));

Thumb.reg('uc-thumb');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

beforeEach(() => {
  mocks.generateThumb.mockReset();
  mocks.cdnLoads = true;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) UploaderRegistry.dispose(name);
});

const uuid = 'c2499162-eb07-4b93-b31e-94a89a47e858';
const imageFile = () => new File(['x'], 'a.png', { type: 'image/png' });

const setup = async (entry: Parameters<UploadCollectionController['add']>[0]) => {
  const ctxName = `thumb-fallback-spec-${seq++}`;
  ctxNames.push(ctxName);
  ensureUploaderCtx(ctxName);
  const container = UploaderRegistry.get(ctxName);
  const collection = container?.get(UploadCollectionController);
  if (!container || !collection) throw new Error('controllers not resolved');
  const sendEventError = vi.spyOn(container.get(TelemetryManager), 'sendEventError').mockImplementation(() => {});
  const el = document.createElement('uc-thumb') as Thumb;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  const uid = collection.add(entry);
  el.uid = uid as Uid;
  const thumbUrl = () => collection.readProp(uid, 'thumbUrl');
  return { thumbUrl, sendEventError };
};

const uploaded = { fileInfo: { uuid } as never, isImage: true, uuid, cdnUrlModifiers: null };

describe('Thumb fallbacks', () => {
  it('generates a local thumb when the CDN thumbnail fails to load', async () => {
    mocks.cdnLoads = false;
    mocks.generateThumb.mockResolvedValue('blob:local');
    const { thumbUrl } = await setup({ ...uploaded, file: imageFile() });

    await vi.waitFor(() => expect(thumbUrl()).toBe('blob:local'));
  });

  it('falls back to the placeholder when the CDN thumbnail and the local thumb both fail', async () => {
    mocks.cdnLoads = false;
    mocks.generateThumb.mockRejectedValue(new Error('decode'));
    const { thumbUrl, sendEventError } = await setup({ ...uploaded, file: imageFile() });

    await vi.waitFor(() => expect(thumbUrl()).toMatch(/^blob:/));
    expect(sendEventError).toHaveBeenCalledWith(
      expect.any(Error),
      'thumbnail generation. Failed to generate thumb from file',
    );
  });

  it('keeps an existing blob thumb when the CDN thumbnail fails to load', async () => {
    vi.useFakeTimers();
    mocks.cdnLoads = false;
    const { thumbUrl } = await setup({ ...uploaded, file: imageFile(), thumbUrl: 'blob:existing' });

    await vi.advanceTimersByTimeAsync(150);
    expect(thumbUrl()).toBe('blob:existing');
    expect(mocks.generateThumb).not.toHaveBeenCalled();
  });

  it('leaves the thumb unset when the CDN thumbnail fails and there is no file', async () => {
    vi.useFakeTimers();
    mocks.cdnLoads = false;
    const { thumbUrl } = await setup(uploaded);

    await vi.advanceTimersByTimeAsync(150);
    expect(thumbUrl()).toBeNull();
    expect(mocks.generateThumb).not.toHaveBeenCalled();
  });

  it('generates a local thumb for an image that is not uploaded yet', async () => {
    mocks.generateThumb.mockResolvedValue('blob:local');
    const { thumbUrl } = await setup({ file: imageFile() });

    await vi.waitFor(() => expect(thumbUrl()).toBe('blob:local'));
  });

  it('falls back to the placeholder when the local thumb fails', async () => {
    mocks.generateThumb.mockRejectedValue(new Error('decode'));
    const { thumbUrl, sendEventError } = await setup({ file: imageFile() });

    await vi.waitFor(() => expect(thumbUrl()).toMatch(/^blob:/));
    expect(sendEventError).toHaveBeenCalledWith(
      expect.any(Error),
      'thumbnail generation. Failed to generate thumb from file',
    );
  });

  it('uses the placeholder for a file that is not an image', async () => {
    const { thumbUrl } = await setup({ file: new File(['x'], 'a.txt', { type: 'text/plain' }) });

    await vi.waitFor(() => expect(thumbUrl()).toMatch(/^blob:/));
    expect(mocks.generateThumb).not.toHaveBeenCalled();
  });
});
