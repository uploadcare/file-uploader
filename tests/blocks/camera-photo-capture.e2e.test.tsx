import { describe, expect, it, vi } from 'vitest';
import { expectActivity, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * Photos come from the preview frame. `ImageCapture.takePhoto()` was tried and dropped: with a real camera the preview
 * changed after a shot and a retake, which the fake camera (`--use-fake-device-for-media-stream`) can't reproduce, so
 * this pins that it stays unused.
 */

type ImageCaptureLike = { prototype: { takePhoto: (settings?: unknown) => Promise<Blob> } };

describe('photos', () => {
  it('come from the preview frame, without ImageCapture', async () => {
    const takePhoto = vi.spyOn(
      (window as unknown as { ImageCapture: ImageCaptureLike }).ImageCapture.prototype,
      'takePhoto',
    );
    const { api, root } = await renderSolution('regular');
    api.initFlow();
    await expectActivity(root, 'start-from');
    await within(root).getByTestId('uc-start-from').getByRole('button', { name: 'Camera', exact: true }).click();
    const camera = within(root).getByTestId('uc-camera-source');
    const shot = camera.getByRole('button', { name: 'Shot', exact: true });
    await expect.element(shot, { timeout: 20_000 }).toBeVisible();
    const video = camera.element().querySelector('video') as HTMLVideoElement;
    await vi.waitFor(() => expect(video.videoWidth).toBeGreaterThan(0));
    const frame = { width: video.videoWidth, height: video.videoHeight };

    await shot.click();
    await camera.getByText('Retake', { exact: true }).click();
    await shot.click();
    await camera.getByRole('button', { name: 'Accept', exact: true }).click();

    await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(1);
    const [entry] = api.getOutputCollectionState().allEntries;
    if (!entry.file) throw new Error('The photo entry has no file');
    const bitmap = await createImageBitmap(entry.file);
    expect({ width: bitmap.width, height: bitmap.height }).toEqual(frame);
    expect(takePhoto).not.toHaveBeenCalled();
  });
});
