import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { delay } from '@/utils/delay';
import { expectActivity, renderSolution } from './utils/render-solution';
import '../types/jsx';

/**
 * Video recording, retake and the microphone toggle — the half of `CameraSource` the existing tests never reach. The
 * chromium instance runs with `--use-fake-device-for-media-stream`, so `MediaRecorder` gets a real stream and the
 * whole record → stop → accept path runs for real.
 */

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

const openCamera = async (configProps: Parameters<typeof renderSolution>[1] = {}) => {
  const rendered = await renderSolution('regular', configProps);
  rendered.api.initFlow();
  await expectActivity(rendered.root, 'start-from');

  await page.getByTestId('uc-start-from').getByText('Camera', { exact: true }).click();
  await expectActivity(rendered.root, 'camera');

  return rendered;
};

const shot = () => page.getByTestId('uc-camera-source--shot').click();
const accept = () => page.getByTestId('uc-camera-source--accept').click();
const openVideoTab = () => page.getByTestId('uc-camera-source--tab-video').click();

describe('photo capture', () => {
  it('offers retake and accept after a shot', async () => {
    const { api } = await openCamera();
    await shot();

    await expect.element(page.getByTestId('uc-camera-source--accept')).toBeVisible();
    await expect.element(page.getByTestId('uc-camera-source').getByText('Retake', { exact: true })).toBeVisible();
    expect(api.getOutputCollectionState().totalCount).toBe(0);
  });

  it('discards the shot on retake', async () => {
    const { api } = await openCamera();
    await shot();

    await page.getByTestId('uc-camera-source').getByText('Retake', { exact: true }).click();

    // Back to the live view: the shutter is offered again and nothing was added.
    await expect.element(page.getByTestId('uc-camera-source--shot')).toBeVisible();
    expect(api.getOutputCollectionState().totalCount).toBe(0);
  });

  it('adds a jpeg named after the capture on accept', async () => {
    const { api } = await openCamera();
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
    const { api } = await openCamera();
    await openVideoTab();

    await shot();
    // The timer replaces the tab strip while recording.
    await expect.element(page.getByTestId('uc-camera-source--recording-timer')).toBeVisible();
    await delay(1200);
    await shot();

    await accept();

    await expect.poll(() => api.getOutputCollectionState().totalCount, { timeout: 20_000 }).toBe(1);
    const [entry] = api.getOutputCollectionState().allEntries;
    expect(entry.name).toMatch(/^video-\d+\.\w+$/);
    expect(entry.mimeType).toMatch(/^video\//);
  });

  it('counts the elapsed time while recording', async () => {
    await openCamera();
    await openVideoTab();

    await shot();
    const timer = page.getByTestId('uc-camera-source--recording-timer');
    await expect.element(timer).toBeVisible();

    await expect.poll(() => timer.element().textContent?.trim(), { timeout: 10_000 }).toMatch(/00:0[1-9]/);

    await shot();
  });

  it('stops on its own once maxVideoRecordingDuration is reached', async () => {
    // Also the only coverage of that option: the timer counts down from it and stops the recording at zero.
    const { api } = await openCamera({ maxVideoRecordingDuration: 2 });
    await openVideoTab();

    await shot();
    await expect.element(page.getByTestId('uc-camera-source--recording-timer')).toBeVisible();

    // No second shutter click: the recording has to end by itself.
    await expect.element(page.getByTestId('uc-camera-source--accept'), { timeout: 20_000 }).toBeVisible();

    await accept();
    await expect.poll(() => api.getOutputCollectionState().totalCount, { timeout: 20_000 }).toBe(1);
  });
});

describe('microphone toggle', () => {
  it('flips the button between muted and unmuted', async () => {
    await openCamera({ enableAudioRecording: true });
    await openVideoTab();

    const toggle = page.getByTestId('uc-camera-source--toggle-microphone');
    await expect.element(toggle).toBeVisible();

    const iconBefore = toggle.element().querySelector('[data-testid="uc-icon"]');
    const nameBefore = (iconBefore as unknown as { name?: string })?.name;

    await toggle.click();

    await expect
      .poll(() => (toggle.element().querySelector('[data-testid="uc-icon"]') as unknown as { name?: string })?.name)
      .not.toBe(nameBefore);
  });
});
