import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloudImageEditorBlock } from './CloudImageEditorBlock';

CloudImageEditorBlock.reg('uc-cloud-image-editor'); // same path as defineComponents(UC); idempotent

const UUID = '9a3c8d5e-0b1f-4c2a-8e7d-6f5b4a3c2d1e';
const mounted: HTMLElement[] = [];

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  vi.restoreAllMocks();
});

const create = (): CloudImageEditorBlock => {
  const el = document.createElement('uc-cloud-image-editor') as CloudImageEditorBlock;
  mounted.push(el);
  return el;
};

describe('CloudImageEditorBlock initial image load', () => {
  // The size wait never settles in happy-dom; only the number of starts matters here.
  const spyUpdateImage = () => vi.spyOn(CloudImageEditorBlock.prototype, 'updateImage').mockResolvedValue();

  it.each([
    ['uuid attribute', (el: CloudImageEditorBlock) => el.setAttribute('uuid', UUID)],
    ['cdn-url attribute', (el: CloudImageEditorBlock) => el.setAttribute('cdn-url', `https://ucarecdn.com/${UUID}/`)],
    ['uuid property', (el: CloudImageEditorBlock) => (el.uuid = UUID)],
    ['cdnUrl property', (el: CloudImageEditorBlock) => (el.cdnUrl = `https://ucarecdn.com/${UUID}/`)],
  ])('starts one load for a source set by %s before the first update', async (_, setSource) => {
    const updateImage = spyUpdateImage();
    const el = create();
    setSource(el);
    document.body.append(el);
    await el.updateComplete;

    expect(updateImage).toHaveBeenCalledTimes(1);
  });

  it('starts one load for a source set right after connecting, before the first update', async () => {
    const updateImage = spyUpdateImage();
    const el = create();
    document.body.append(el);
    el.uuid = UUID;
    await el.updateComplete;

    expect(updateImage).toHaveBeenCalledTimes(1);
  });

  it('starts no load without a source', async () => {
    const updateImage = spyUpdateImage();
    const el = create();
    document.body.append(el);
    await el.updateComplete;

    expect(updateImage).not.toHaveBeenCalled();
  });
});
