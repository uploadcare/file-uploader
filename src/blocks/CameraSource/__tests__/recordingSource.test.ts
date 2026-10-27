import { describe, expect, it } from 'vitest';
import { planRecording } from '../recordingSource';

const plan = (overrides: Partial<Parameters<typeof planRecording>[0]> = {}) =>
  planRecording({ width: 1920, height: 1080, aspectRatio: null, mirror: false, canCaptureCanvas: true, ...overrides });

describe('planRecording', () => {
  it('records the camera as is without a ratio or mirroring', () => {
    expect(plan()).toBe('direct');
  });

  it('records the camera as is when it already delivers the ratio', () => {
    expect(plan({ width: 1080, height: 1080, aspectRatio: 1 })).toBe('direct');
    // 16:9 from a 1366×768 camera is 1.7786, not exactly 16/9.
    expect(plan({ width: 1366, height: 768, aspectRatio: 16 / 9 })).toBe('direct');
  });

  it('crops through the canvas when the camera delivers another shape', () => {
    expect(plan({ aspectRatio: 1 })).toBe('canvas');
    expect(plan({ aspectRatio: 9 / 16 })).toBe('canvas');
  });

  it('mirrors through the canvas, even without a ratio', () => {
    expect(plan({ mirror: true })).toBe('canvas');
  });

  it('is unsupported when it needs the canvas and the browser cannot record one', () => {
    expect(plan({ aspectRatio: 1, canCaptureCanvas: false })).toBe('unsupported');
    expect(plan({ mirror: true, canCaptureCanvas: false })).toBe('unsupported');
    expect(plan({ canCaptureCanvas: false })).toBe('direct');
  });
});
