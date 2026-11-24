import { describe, expect, it } from 'vitest';
import { CloudImageEditorController } from './CloudImageEditorController';
import { cropperImageSrc, trackImageLoading } from './util';

const ORIGINAL = 'https://ucarecdn.com/c2499162-eb07-4b93-b31e-94a89a47e858/';

describe('cropperImageSrc', () => {
  it('keeps the appearance the user set', () => {
    expect(cropperImageSrc(ORIGINAL, 500, { brightness: 20 })).toContain('/-/brightness/20/');
  });

  it('leaves out the geometry, so the crop is drawn on the uncropped image', () => {
    const src = cropperImageSrc(ORIGINAL, 500, {
      brightness: 20,
      crop: { dimensions: [100, 80], coords: [10, 20] },
      rotate: 90,
      flip: true,
      mirror: true,
    });
    expect(src).not.toMatch(/\/-\/(crop|rotate|flip|mirror)\//);
    expect(src).toContain('/-/brightness/20/');
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
