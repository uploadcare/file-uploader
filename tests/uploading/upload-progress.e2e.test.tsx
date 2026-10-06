import { expect, it } from 'vitest';
import type { Uid } from '@/lit/Uid';
import { recordEvents } from '~/tests/utils/event-recorder';
import { renderSolution } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * A real image of a few megabytes: noise does not compress, so the PNG weighs about what the pixels do. Live, the
 * demo project refuses anything that is not an image and anything over 5 MB.
 */
const bigImage = async () => {
  const side = 1000;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = side;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(side, side);
  for (let offset = 0; offset < image.data.length; offset += 65536) {
    crypto.getRandomValues(image.data.subarray(offset, offset + 65536));
  }
  context.putImageData(image, 0, 0);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
  return new File([blob], 'noise.png', { type: 'image/png' });
};

/**
 * The fake network has to report an upload the way a real one does: a few percent at a time, not in one jump, or the
 * progress UI and the progress events are never exercised. The entry's `uploadProgress` is watched directly because
 * the store debounces its observers, so every tick of an in-page upload lands in one `file-upload-progress` event.
 */
it('reports the progress of a multi-megabyte upload incrementally', async () => {
  const { api, provider } = await renderSolution('regular', { store: false });
  const recorder = recordEvents(provider);

  const file = await bigImage();
  expect(file.size).toBeGreaterThan(2 * 1024 * 1024);
  const entry = api.addFileFromObject(file);
  await recorder.waitFor('file-added');
  const progress: number[] = [];
  provider.uploadCollection.read(entry.internalId as Uid)!.subscribe('uploadProgress', (value) => progress.push(value));

  api.uploadAll();
  await recorder.waitFor('common-upload-success');

  const partial = progress.filter((value) => value > 0 && value < 100);
  expect(partial.length).toBeGreaterThan(1);
  expect(progress).toEqual([...progress].sort((a, b) => a - b));
  expect(recorder.detailsOf('file-upload-progress').length).toBeGreaterThan(0);
});
