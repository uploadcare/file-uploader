import { describe, expect, it, vi } from 'vitest';
import { UID } from '../../../../utils/UID';
import { getClosestAspectRatio, parseCropPreset } from './parseCropPreset';

describe('parseCropPreset', () => {
  it('should parse crop presets correctly', () => {
    const uniqueIds = 4;
    let uidCallCount = 0;

    const generateSpy = vi.spyOn(UID, 'generate').mockImplementation(() => {
      const id = `id-${(uidCallCount % uniqueIds) + 1}`;
      uidCallCount += 1;
      return id;
    });

    const input = '16:9, 3:4, 4:3, 1:1';
    const uuid = () => UID.generate();
    const expected = [
      { id: uuid(), type: 'aspect-ratio', width: 16, height: 9, hasFreeform: false },
      { id: uuid(), type: 'aspect-ratio', width: 3, height: 4, hasFreeform: false },
      { id: uuid(), type: 'aspect-ratio', width: 4, height: 3, hasFreeform: false },
      { id: uuid(), type: 'aspect-ratio', width: 1, height: 1, hasFreeform: false },
    ];
    const list = parseCropPreset(input);
    expect(list).toEqual(expected);

    expect(getClosestAspectRatio(400, 500, list, 0.1)).toEqual({
      hasFreeform: false,
      height: 4,
      id: 'id-2',
      type: 'aspect-ratio',
      width: 3,
    });

    generateSpy.mockRestore();
  });
});
