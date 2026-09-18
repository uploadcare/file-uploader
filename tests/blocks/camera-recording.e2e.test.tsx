import { describe, expect, it } from 'vitest';
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

  await within(rendered.root).getByTestId('uc-start-from').getByText('Camera', { exact: true }).click();
  await expectActivity(rendered.root, 'camera');

  const camera = within(rendered.root).getByTestId('uc-camera-source');
  return {
    ...rendered,
    camera,
    shot: () => camera.getByTestId('uc-camera-source--shot').click(),
    accept: () => camera.getByTestId('uc-camera-source--accept').click(),
    openVideoTab: () => camera.getByTestId('uc-camera-source--tab-video').click(),
  };
};

describe('photo capture', () => {
  it('offers retake and accept after a shot', async () => {
    const { api, camera, shot } = await openCamera();
    await shot();

    await expect.element(camera.getByTestId('uc-camera-source--accept')).toBeVisible();
    await expect.element(camera.getByText('Retake', { exact: true })).toBeVisible();
    expect(api.getOutputCollectionState().totalCount).toBe(0);
  });

  it('discards the shot on retake', async () => {
    const { api, camera, shot } = await openCamera();
    await shot();

    await camera.getByText('Retake', { exact: true }).click();

    // Back to the live view: the shutter is offered again and nothing was added.
    await expect.element(camera.getByTestId('uc-camera-source--shot')).toBeVisible();
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

describe('video recording', () => {
  it('records, stops and adds the clip', async () => {
    const { api, camera, shot, accept, openVideoTab } = await openCamera();
    await openVideoTab();

    await shot();
    // The timer replaces the tab strip while recording.
    const timer = camera.getByTestId('uc-camera-source--recording-timer');
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

  it('counts the elapsed time while recording', async () => {
    const { camera, shot, openVideoTab } = await openCamera();
    await openVideoTab();

    await shot();
    const timer = camera.getByTestId('uc-camera-source--recording-timer');
    await expect.element(timer).toBeVisible();

    await expect.poll(() => timer.element().textContent?.trim(), { timeout: 10_000 }).toMatch(/00:0[1-9]/);

    await shot();
  });

  it('stops on its own once maxVideoRecordingDuration is reached', async () => {
    // Also the only coverage of that option: the timer counts down from it and stops the recording at zero.
    const { api, camera, shot, accept, openVideoTab } = await openCamera({ maxVideoRecordingDuration: 2 });
    await openVideoTab();

    await shot();
    await expect.element(camera.getByTestId('uc-camera-source--recording-timer')).toBeVisible();

    // No second shutter click: the recording has to end by itself.
    await expect.element(camera.getByTestId('uc-camera-source--accept'), { timeout: 20_000 }).toBeVisible();

    await accept();
    await expect.poll(() => api.getOutputCollectionState().totalCount, { timeout: 20_000 }).toBe(1);
  });
});

describe('microphone toggle', () => {
  it('flips the button between muted and unmuted', async () => {
    const { camera, openVideoTab } = await openCamera({ enableAudioRecording: true });
    await openVideoTab();

    const toggle = camera.getByTestId('uc-camera-source--toggle-microphone');
    await expect.element(toggle).toBeVisible();

    const iconName = () => (toggle.getByTestId('uc-icon').query() as Icon | null)?.name;
    const nameBefore = iconName();

    await toggle.click();

    await expect.poll(iconName).not.toBe(nameBefore);
  });
});
