import { describe, expect, it } from 'vitest';
import { operationsFromModifiers } from '../../../utils/cdn/operations';
import { CloudImageEditorController } from './CloudImageEditorController';
import { cropperImageSrc, trackImageLoading } from './util';

const ORIGINAL = 'https://ucarecdn.com/c2499162-eb07-4b93-b31e-94a89a47e858/';

describe('cropperImageSrc', () => {
  it('shows the image the crop is drawn on: no geometry, nothing the source applied after it', () => {
    const source = operationsFromModifiers('overlay/wm-uuid', 'crop/200x150/100,50', 'resize/100x');
    const src = cropperImageSrc(
      ORIGINAL,
      500,
      { crop: { dimensions: [200, 150], coords: [100, 50] }, rotate: 90 },
      source,
    );

    expect(src).toContain('/-/overlay/wm-uuid/');
    expect(src).not.toContain('/-/crop/');
    expect(src).not.toContain('/-/rotate/');
    expect(src).not.toContain('/-/resize/100x/');
  });

  it('keeps the appearance the user set', () => {
    expect(cropperImageSrc(ORIGINAL, 500, { brightness: 20 }, [])).toContain('/-/brightness/20/');
  });
});

describe('trackImageLoading', () => {
  it('counts each load until its own stop, and a second stop is a no-op', () => {
    const controller = new CloudImageEditorController();
    // Two loads of the same src: the first to finish must not hide the loader.
    const stopA = trackImageLoading(controller);
    const stopB = trackImageLoading(controller);
    stopA();
    stopA();
    expect(controller.loadingImages).toBe(1);
    stopB();
    expect(controller.loadingImages).toBe(0);
  });
});
