import { describe, expect, it } from 'vitest';
import { centerCrop, parseAspectRatio } from '../aspectRatio';

describe('parseAspectRatio', () => {
  it.each([
    ['16:9', 16 / 9],
    ['9:16', 9 / 16],
    ['1:1', 1],
    ['4:3', 4 / 3],
    [' 3 : 2 ', 3 / 2],
    ['1.91:1', 1.91],
  ])('parses %j', (value, expected) => {
    expect(parseAspectRatio(value)).toBeCloseTo(expected);
  });

  it('treats an empty value as the native shape', () => {
    expect(parseAspectRatio('')).toBeNull();
    expect(parseAspectRatio('  ')).toBeNull();
  });

  it.each(['16/9', '16:', ':9', '0:1', '1:0', '-1:1', 'wide', '16:9:1'])('rejects %j', (value) => {
    expect(() => parseAspectRatio(value)).toThrow(/Invalid aspect ratio/);
  });
});

describe('centerCrop', () => {
  it('trims the sides of a frame that is wider than the ratio', () => {
    expect(centerCrop(1920, 1080, 1)).toEqual({ x: 420, y: 0, width: 1080, height: 1080 });
  });

  it('trims the top and bottom of a frame that is taller than the ratio', () => {
    expect(centerCrop(1080, 1920, 1)).toEqual({ x: 0, y: 420, width: 1080, height: 1080 });
  });

  it('keeps a frame that already has the ratio', () => {
    expect(centerCrop(1920, 1080, 16 / 9)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  it('crops a landscape frame to portrait', () => {
    expect(centerCrop(1920, 1080, 9 / 16)).toEqual({ x: 656, y: 0, width: 608, height: 1080 });
  });
});
