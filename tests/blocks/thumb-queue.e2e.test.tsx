import { beforeAll, describe, expect, it, vi } from 'vitest';
import { isLive } from '~/tests/utils/emulator.browser';
import { IMAGE } from '../fixtures/files';
import { renderSolution } from '../utils/render-solution';
import '../../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

describe('uc-thumb local thumbnail queue', () => {
  it.skipIf(isLive)(
    'decodes a few files at a time when a list of photos opens',
    async () => {
      // `generateThumb` holds an object URL of the source file for as long as it decodes it, so the ones created from a
      // File and not yet revoked are the decodes in flight. The finished thumbnail's URL comes from a plain Blob.
      const decoding = new Set<string>();
      let mostAtOnce = 0;
      let decoded = 0;
      const createObjectURL = URL.createObjectURL.bind(URL);
      vi.spyOn(URL, 'createObjectURL').mockImplementation((source) => {
        const url = createObjectURL(source);
        if (source instanceof File) {
          decoding.add(url);
          mostAtOnce = Math.max(mostAtOnce, decoding.size);
        }
        return url;
      });
      const revokeObjectURL = URL.revokeObjectURL.bind(URL);
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
        if (decoding.delete(url)) decoded++;
        revokeObjectURL(url);
      });

      // The inline list renders every row, so all twelve thumbs ask at once.
      const { api, root } = await renderSolution('inline', { confirmUpload: true });
      for (let i = 0; i < 12; i++) {
        api.addFileFromObject(new File([IMAGE.SQUARE], `photo-${i}.jpg`, { type: 'image/jpeg' }));
      }
      api.setCurrentActivity('upload-list');

      const drawn = () => root.querySelectorAll('uc-thumb img.uc-thumb__img[src^="blob:"]').length;
      await expect.poll(drawn, { timeout: 20_000 }).toBe(12);
      expect(decoded).toBe(12);
      expect(mostAtOnce).toBe(4);
    },
    30_000,
  );
});
