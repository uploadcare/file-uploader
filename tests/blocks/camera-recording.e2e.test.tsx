import { describe, expect, it, onTestFinished, vi } from 'vitest';
import type { Icon } from '@/index';
import { expectActivity, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * Video recording, retake and the microphone toggle — the half of `CameraSource` the existing tests never reach. The
 * chromium instance runs with `--use-fake-device-for-media-stream`, so `MediaRecorder` gets a real stream and the
 * whole record → stop → accept path runs for real.
 */

const openCamera = async (configProps: Parameters<typeof renderSolution>[1] = {}) => {
  const rendered = await renderSolution('regular', configProps);
  rendered.api.initFlow();
  await expectActivity(rendered.root, 'start-from');

  await within(rendered.root).getByTestId('uc-start-from').getByRole('button', { name: 'Camera', exact: true }).click();
  await expectActivity(rendered.root, 'camera');

  const camera = within(rendered.root).getByTestId('uc-camera-source');
  return {
    ...rendered,
    camera,
    // By test id: the shutter is named after what it does next, which changes with the mode.
    shot: () => camera.getByTestId('uc-camera-controls--shot').click(),
    accept: () => camera.getByRole('button', { name: 'Accept', exact: true }).click(),
    openVideoTab: () => camera.getByRole('button', { name: 'Video', exact: true }).click(),
  };
};

describe('photo capture', () => {
  it('offers retake and accept after a shot', async () => {
    const { api, camera, shot } = await openCamera();
    await shot();

    await expect.element(camera.getByRole('button', { name: 'Accept', exact: true })).toBeVisible();
    await expect.element(camera.getByText('Retake', { exact: true })).toBeVisible();
    expect(api.getOutputCollectionState().totalCount).toBe(0);
  });

  it('discards the shot on retake', async () => {
    const { api, camera, shot } = await openCamera();
    await shot();

    await camera.getByText('Retake', { exact: true }).click();

    // Back to the live view: the shutter is offered again and nothing was added.
    await expect.element(camera.getByRole('button', { name: 'Shot', exact: true })).toBeVisible();
    expect(api.getOutputCollectionState().totalCount).toBe(0);
  });

  it('adds a jpeg named after the capture on accept', async () => {
    const { api, shot, accept } = await openCamera();
    await shot();
    await accept();

    await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(1);
    const [entry] = api.getOutputCollectionState().allEntries;
    expect(entry.name).toMatch(/^camera-\d+\.jpeg$/);
    expect(entry.mimeType).toBe('image/jpeg');
  });
});

describe('accessible names', () => {
  // Every control below renders only a `uc-icon`, which is `aria-hidden`, so the name has to come from `aria-label`.
  it('names the mode tabs and the photo shutter', async () => {
    const { camera } = await openCamera();

    await expect.element(camera.getByTestId('uc-camera-controls--tab-photo')).toHaveAccessibleName('Photo');
    await expect.element(camera.getByTestId('uc-camera-controls--tab-video')).toHaveAccessibleName('Video');
    await expect.element(camera.getByTestId('uc-camera-controls--shot')).toHaveAccessibleName('Shot');
  });

  it('names the video shutter by what it does next', async () => {
    const { camera, shot, openVideoTab } = await openCamera();
    await openVideoTab();
    const shutter = camera.getByTestId('uc-camera-controls--shot');

    await expect.element(shutter).toHaveAccessibleName('Record Video');
    await shot();
    await expect.element(shutter).toHaveAccessibleName('Stop recording');
  });

  it('names the microphone toggle and exposes whether it is on', async () => {
    const { camera, openVideoTab } = await openCamera();
    await openVideoTab();
    const toggle = camera.getByTestId('uc-camera-controls--toggle-microphone');

    await expect.element(toggle).toHaveAccessibleName('Microphone');
    await expect.element(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect.element(toggle).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('video recording', () => {
  it('records, stops and adds the clip', async () => {
    const { api, camera, shot, accept, openVideoTab } = await openCamera();
    await openVideoTab();

    await shot();
    // The timer replaces the tab strip while recording.
    const timer = camera.getByTestId('uc-camera-controls--recording-timer');
    await expect.element(timer).toBeVisible();
    // Stop only once at least a second was captured, so the recorder has data to emit for the clip.
    await expect.poll(() => timer.element().textContent?.trim(), { timeout: 10_000 }).toMatch(/00:0[1-9]/);
    await shot();

    await accept();

    await expect.poll(() => api.getOutputCollectionState().totalCount, { timeout: 20_000 }).toBe(1);
    const [entry] = api.getOutputCollectionState().allEntries;
    expect(entry.name).toMatch(/^video-\d+\.\w+$/);
    expect(entry.mimeType).toMatch(/^video\//);
  });

  it('releases the preview of a recording that is retaken', async () => {
    const { camera, shot, openVideoTab } = await openCamera();
    await openVideoTab();
    const create = vi.spyOn(URL, 'createObjectURL');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    onTestFinished(() => {
      vi.restoreAllMocks();
    });

    await shot();
    const timer = camera.getByTestId('uc-camera-controls--recording-timer');
    await expect.poll(() => timer.element().textContent?.trim(), { timeout: 10_000 }).toMatch(/00:0[1-9]/);
    await shot();
    await expect.element(camera.getByText('Retake', { exact: true })).toBeVisible();
    const previewUrl = create.mock.results[0]?.value;
    expect(previewUrl).toMatch(/^blob:/);

    await camera.getByText('Retake', { exact: true }).click();

    expect(revoke).toHaveBeenCalledWith(previewUrl);
  });

  it('counts the elapsed time while recording', async () => {
    const { camera, shot, openVideoTab } = await openCamera();
    await openVideoTab();

    await shot();
    const timer = camera.getByTestId('uc-camera-controls--recording-timer');
    await expect.element(timer).toBeVisible();

    await expect.poll(() => timer.element().textContent?.trim(), { timeout: 10_000 }).toMatch(/00:0[1-9]/);

    await shot();
  });

  it('stops on its own once maxVideoRecordingDuration is reached', async () => {
    // Also the only coverage of that option: the timer counts down from it and stops the recording at zero.
    const { api, camera, shot, accept, openVideoTab } = await openCamera({ maxVideoRecordingDuration: 2 });
    await openVideoTab();

    await shot();
    await expect.element(camera.getByTestId('uc-camera-controls--recording-timer')).toBeVisible();

    // No second shutter click: the recording has to end by itself.
    await expect
      .element(camera.getByRole('button', { name: 'Accept', exact: true }), { timeout: 20_000 })
      .toBeVisible();

    await accept();
    await expect.poll(() => api.getOutputCollectionState().totalCount, { timeout: 20_000 }).toBe(1);
  });
});

describe('microphone toggle', () => {
  it('flips the button between muted and unmuted', async () => {
    const { camera, openVideoTab } = await openCamera({ enableAudioRecording: true });
    await openVideoTab();

    const toggle = camera.getByTestId('uc-camera-controls--toggle-microphone');
    await expect.element(toggle).toBeVisible();

    const iconName = () => (toggle.getByTestId('uc-icon').query() as Icon | null)?.name;
    const nameBefore = iconName();

    await toggle.click();

    await expect.poll(iconName).not.toBe(nameBefore);
  });
});
