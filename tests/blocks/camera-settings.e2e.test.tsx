import { describe, expect, it, vi } from 'vitest';
import type { Locator } from 'vitest/browser';
import type { Config } from '@/index';
import { settingOf } from '~/tests/utils/camera-settings';
import { expectActivity, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * The aspect ratio and resolution settings in the camera settings accordion, against chromium's fake camera
 * (`--use-fake-device-for-media-stream`). Located by accessible name, which also checks the labels.
 */

const openCamera = async (configProps: Partial<Config> = {}) => {
  const getUserMedia = vi.spyOn(navigator.mediaDevices, 'getUserMedia');

  const rendered = await renderSolution('regular', configProps);
  rendered.api.initFlow();
  await expectActivity(rendered.root, 'start-from');

  await within(rendered.root).getByTestId('uc-start-from').getByRole('button', { name: 'Camera', exact: true }).click();
  await expectActivity(rendered.root, 'camera');

  const camera = within(rendered.root).getByTestId('uc-camera-source');
  await expect.element(camera.getByRole('button', { name: 'Shot', exact: true }), { timeout: 20_000 }).toBeVisible();

  return {
    ...rendered,
    camera,
    getUserMedia,
    settingsButton: camera.getByRole('button', { name: 'Camera settings', exact: true, includeHidden: true }),
    ratio: settingOf(camera, 'Aspect ratio'),
    resolution: settingOf(camera, 'Resolution'),
  };
};

/** Takes a photo, accepts it and returns its pixel size. */
const takePhoto = async ({ api, camera }: Awaited<ReturnType<typeof openCamera>>) => {
  await camera.getByRole('button', { name: 'Shot', exact: true }).click();
  await camera.getByRole('button', { name: 'Accept', exact: true }).click();

  await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(1);
  const [entry] = api.getOutputCollectionState().allEntries;
  if (!entry.file) throw new Error('The photo entry has no file');
  const bitmap = await createImageBitmap(entry.file);
  return { width: bitmap.width, height: bitmap.height };
};

describe('camera settings button', () => {
  it('is hidden without option lists', async () => {
    const { settingsButton } = await openCamera();

    await expect.element(settingsButton).not.toBeVisible();
  });

  it('is hidden when a list has a single option', async () => {
    const { settingsButton } = await openCamera({ cameraAspectRatio: '1:1', cameraResolution: '720p' });

    await expect.element(settingsButton).not.toBeVisible();
  });

  it('opens both settings, labelled and closed', async () => {
    const opened = await openCamera({
      cameraAspectRatio: 'native, 1:1, 4:3',
      cameraResolution: 'auto, 720p',
    });

    await opened.settingsButton.click();

    await expect.element(opened.ratio.row).toBeVisible();
    await expect.element(opened.resolution.row).toBeVisible();
    await expect.element(opened.ratio.options).not.toBeVisible();
    await expect.element(opened.resolution.options).not.toBeVisible();
    expect(opened.ratio.texts()).toEqual(['Original', '1:1', '4:3']);
    expect(opened.resolution.texts()).toEqual(['Auto', '720P']);
  });

  it('shows the value in effect on each row', async () => {
    const opened = await openCamera({ cameraAspectRatio: '4:3, native', cameraResolution: 'auto, 720p' });

    await opened.settingsButton.click();
    await opened.resolution.pick('720P');

    const rowText = (row: Locator) => row.element().closest('summary')?.textContent?.replace(/\s+/g, ' ').trim();
    expect(rowText(opened.ratio.row)).toBe('Aspect ratio 4:3');
    expect(rowText(opened.resolution.row)).toBe('Resolution 720P');
  });

  it('opens one section at a time', async () => {
    const opened = await openCamera({ cameraAspectRatio: 'native, 1:1', cameraResolution: 'auto, 720p' });
    await opened.settingsButton.click();

    await opened.ratio.row.click();
    await expect.element(opened.ratio.option('1:1')).toBeVisible();

    await opened.resolution.row.click();
    await expect.element(opened.resolution.option('720P')).toBeVisible();
    expect(opened.ratio.isOpen()).toBe(false);
  });

  it('shows a lone section as just its options, still labelled', async () => {
    const opened = await openCamera({ cameraAspectRatio: 'native, 1:1' });

    await opened.settingsButton.click();

    await expect.element(opened.ratio.option('1:1')).toBeVisible();
    await expect.element(opened.ratio.row).not.toBeVisible();
    expect(opened.ratio.isOpen()).toBe(true);
  });

  it('sits in the bottom bar, next to mute, and opens upward', async () => {
    const opened = await openCamera({ cameraAspectRatio: 'native, 1:1' });
    const button = opened.settingsButton.element();
    expect(button.closest('.uc-controls')).not.toBeNull();
    expect(button.closest('uc-activity-header')).toBeNull();

    await opened.settingsButton.click();

    await expect.element(opened.ratio.options).toBeVisible();
    // Chromium supports anchor positioning, so the popup is placed above the button rather than centered.
    const popup = opened.ratio.options.element().closest('[popover]');
    expect(popup?.getBoundingClientRect().bottom).toBeLessThanOrEqual(button.getBoundingClientRect().top);

    await opened.camera.getByRole('button', { name: 'Video', exact: true }).click();
    const mute = opened.camera.getByTestId('uc-camera-source--toggle-microphone');
    await expect.element(mute).toBeVisible();
    expect(mute.element().parentElement).toBe(button.parentElement);
  });

  it('hides while a photo waits for review', async () => {
    const { camera, settingsButton } = await openCamera({ cameraAspectRatio: 'native, 1:1' });
    await expect.element(settingsButton).toBeVisible();

    await camera.getByRole('button', { name: 'Shot', exact: true }).click();

    await expect.element(settingsButton).not.toBeVisible();
  });

  it('hides while recording', async () => {
    const { camera, settingsButton } = await openCamera({ cameraResolution: 'auto, 720p' });
    await camera.getByRole('button', { name: 'Video', exact: true }).click();
    await expect.element(settingsButton).toBeVisible();

    await camera.getByRole('button', { name: 'Shot', exact: true }).click();

    await expect.element(camera.getByTestId('uc-camera-source--recording-timer')).toBeVisible();
    await expect.element(settingsButton).not.toBeVisible();
  });
});

describe('camera picker', () => {
  it('is offered in the settings rather than the header once there are several cameras', async () => {
    const enumerateDevices = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    const second = { kind: 'videoinput', deviceId: 'second-camera', label: 'Second camera', groupId: 'second' };
    vi.spyOn(navigator.mediaDevices, 'enumerateDevices').mockImplementation(async () => [
      ...(await enumerateDevices()),
      { ...second, toJSON: () => second } as MediaDeviceInfo,
    ]);
    const opened = await openCamera();
    // The header still says "Camera", so the section is found by its options rather than by that text.
    const cameras = settingOf(opened.camera, 'Camera');

    await opened.settingsButton.click();

    await expect.element(cameras.option('Second camera')).toBeVisible();
    expect(cameras.texts()).toHaveLength(2);
    expect(opened.camera.element().querySelector('uc-activity-header :is(uc-select, [role="radiogroup"])')).toBeNull();
  });
});

describe('aspect ratio picker', () => {
  it('crops the photo to the pick without changing the config', async () => {
    const opened = await openCamera({ cameraAspectRatio: 'native, 1:1' });
    await opened.settingsButton.click();

    await opened.ratio.pick('1:1');
    const photo = await takePhoto(opened);

    expect(photo.width).toBe(photo.height);
    expect(opened.config.cameraAspectRatio).toBe('native, 1:1');
  });

  it('is offered in video mode too', async () => {
    const opened = await openCamera({ cameraAspectRatio: 'native, 1:1', cameraResolution: 'auto, 720p' });
    await opened.camera.getByRole('button', { name: 'Video', exact: true }).click();

    await opened.settingsButton.click();

    await expect.element(opened.resolution.row).toBeVisible();
    await expect.element(opened.ratio.row).toBeVisible();
  });

  it('starts on the first listed ratio', async () => {
    const opened = await openCamera({ cameraAspectRatio: '1:1, 4:3' });

    await opened.settingsButton.click();

    await expect.element(opened.ratio.option('1:1')).toBeChecked();
    const photo = await takePhoto(opened);
    expect(photo.width).toBe(photo.height);
  });

  it('starts over when the config changes', async () => {
    const opened = await openCamera({ cameraAspectRatio: 'native, 1:1, 4:3' });
    await opened.settingsButton.click();
    await opened.ratio.pick('4:3');

    opened.config.cameraAspectRatio = '1:1, native';

    await expect.element(opened.ratio.option('1:1')).toBeChecked();
  });
});

describe('resolution picker', () => {
  it('applies the pick to the open camera without reopening it', async () => {
    const opened = await openCamera({ cameraResolution: 'auto, 720p' });
    const applyConstraints = vi.spyOn(MediaStreamTrack.prototype, 'applyConstraints');
    await opened.settingsButton.click();

    await opened.resolution.pick('720P');

    await vi.waitFor(() =>
      expect(applyConstraints).toHaveBeenCalledWith(
        expect.objectContaining({ width: { ideal: 1280 }, height: { ideal: 720 } }),
      ),
    );
    expect(opened.getUserMedia).toHaveBeenCalledTimes(1);
    expect(opened.config.cameraResolution).toBe('auto, 720p');
  });

  it('leaves out presets the camera cannot do', async () => {
    vi.spyOn(MediaStreamTrack.prototype, 'getCapabilities').mockReturnValue({
      width: { max: 1280 },
      height: { max: 720 },
    });
    const opened = await openCamera({ cameraResolution: 'auto, 720p, 1080p, 4k' });

    await opened.settingsButton.click();

    expect(opened.resolution.texts()).toEqual(['Auto', '720P']);
  });
});
