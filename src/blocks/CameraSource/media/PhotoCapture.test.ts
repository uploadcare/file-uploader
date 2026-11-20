import { afterEach, describe, expect, it, vi } from 'vitest';
import { photoFile } from './PhotoCapture';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('photoFile', () => {
  it('photoFile names the file at call time', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    const file = photoFile(new Blob(['jpeg']));
    expect([file.name, file.type, file.lastModified]).toEqual(['camera-2000.jpeg', 'image/jpeg', 2000]);
  });
});
