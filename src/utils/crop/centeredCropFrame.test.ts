import { describe, expect, it } from 'vitest';
import { calculateMaxCenteredCropFrame } from './centeredCropFrame';

describe('calculateMaxCenteredCropFrame', () => {
  it('should calculate centered crop for wider image than aspect ratio', () => {
    const result = calculateMaxCenteredCropFrame(1600, 900, 4 / 3);

    expect(result.width).toBeLessThanOrEqual(1600);
    expect(result.height).toBe(900);
    expect(result.x).toBeGreaterThan(0);
    expect(result.y).toBe(0);
  });

  it('should calculate centered crop for taller image than aspect ratio', () => {
    const result = calculateMaxCenteredCropFrame(800, 1200, 4 / 3);

    expect(result.width).toBe(800);
    expect(result.height).toBeLessThanOrEqual(1200);
    expect(result.x).toBe(0);
    expect(result.y).toBeGreaterThan(0);
  });

  it('should calculate crop for exact aspect ratio match', () => {
    const result = calculateMaxCenteredCropFrame(800, 600, 4 / 3);

    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('should calculate crop for 1:1 aspect ratio', () => {
    const result = calculateMaxCenteredCropFrame(1920, 1080, 1);

    expect(result.width).toBe(1080);
    expect(result.height).toBe(1080);
    expect(result.x).toBe(420);
    expect(result.y).toBe(0);
  });

  it('should calculate crop for 16:9 aspect ratio on 4:3 image', () => {
    const result = calculateMaxCenteredCropFrame(800, 600, 16 / 9);

    expect(result.width).toBe(800);
    expect(result.height).toBeLessThanOrEqual(600);
    expect(Math.abs(result.width / result.height - 16 / 9)).toBeLessThan(0.1);
  });

  it('should not exceed image bounds', () => {
    const result = calculateMaxCenteredCropFrame(100, 100, 2);

    expect(result.x + result.width).toBeLessThanOrEqual(100);
    expect(result.y + result.height).toBeLessThanOrEqual(100);
  });
});

/**
 * `calculateMaxCenteredCropFrame` rounds the crop box, then clamps it back if the rounding pushed it past the
 * source. With integer dimensions the clamps never fire — `Math.round((w - cw) / 2) <= w - cw` holds for every
 * integer — so they are only reachable when the caller passes fractional sizes, which is what these cover.
 */
describe('calculateMaxCenteredCropFrame rounding overflow', () => {
  it('clamps the width when rounding pushes the crop past a fractional source width', () => {
    const frame = calculateMaxCenteredCropFrame(1.75, 1, 1.5);

    expect(frame.x + frame.width).toBeLessThanOrEqual(1.75);
  });

  it('clamps the height when rounding pushes the crop past a fractional source height', () => {
    const frame = calculateMaxCenteredCropFrame(1.5, 1.5, 1);

    expect(frame.y + frame.height).toBeLessThanOrEqual(1.5);
  });
});
