import { describe, expect, it, vi } from 'vitest';
import type { Locator } from 'vitest/browser';
import type { Config } from '@/index';
import { expectActivity, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * The aspect ratio and quality pickers in the camera header, against chromium's fake camera
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
    ratioPicker: camera.getByRole('combobox', { name: 'Aspect ratio', exact: true, includeHidden: true }),
    qualityPicker: camera.getByRole('combobox', { name: 'Quality', exact: true, includeHidden: true }),
  };
};

const optionTexts = (picker: Locator) =>
  [...(picker.element() as HTMLSelectElement).options].map((option) => option.textContent);

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
    const { settingsButton } = await openCamera({ cameraAspectRatioOptions: '1:1', cameraQualityOptions: '720p' });

    await expect.element(settingsButton).not.toBeVisible();
  });

  it('opens both pickers, labelled', async () => {
    const opened = await openCamera({
      cameraAspectRatioOptions: 'native, 1:1, 4:3',
      cameraQualityOptions: 'auto, 720p',
    });

    await opened.settingsButton.click();

    await expect.element(opened.ratioPicker).toBeVisible();
    await expect.element(opened.qualityPicker).toBeVisible();
    expect(optionTexts(opened.ratioPicker)).toEqual(['Original', '1:1', '4:3']);
    expect(optionTexts(opened.qualityPicker)).toEqual(['Auto', '720P']);
  });

  it('hides while a photo waits for review', async () => {
    const { camera, settingsButton } = await openCamera({ cameraAspectRatioOptions: 'native, 1:1' });
    await expect.element(settingsButton).toBeVisible();

    await camera.getByRole('button', { name: 'Shot', exact: true }).click();

    await expect.element(settingsButton).not.toBeVisible();
  });

  it('hides while recording', async () => {
    const { camera, settingsButton } = await openCamera({ cameraQualityOptions: 'auto, 720p' });
    await camera.getByRole('button', { name: 'Video', exact: true }).click();
    await expect.element(settingsButton).toBeVisible();

    await camera.getByRole('button', { name: 'Shot', exact: true }).click();

    await expect.element(camera.getByTestId('uc-camera-source--recording-timer')).toBeVisible();
    await expect.element(settingsButton).not.toBeVisible();
  });
});

describe('aspect ratio picker', () => {
  it('crops the photo to the pick without changing the config', async () => {
    const opened = await openCamera({ cameraAspectRatioOptions: 'native, 1:1' });
    await opened.settingsButton.click();

    await opened.ratioPicker.selectOptions('1:1');
    const photo = await takePhoto(opened);

    expect(photo.width).toBe(photo.height);
    expect(opened.config.cameraAspectRatio).toBe('');
  });

  it('is offered in video mode too', async () => {
    const opened = await openCamera({ cameraAspectRatioOptions: 'native, 1:1', cameraQualityOptions: 'auto, 720p' });
    await opened.camera.getByRole('button', { name: 'Video', exact: true }).click();

    await opened.settingsButton.click();

    await expect.element(opened.qualityPicker).toBeVisible();
    await expect.element(opened.ratioPicker).toBeVisible();
  });

  it('starts on the first option, with a warning, when the configured ratio is not listed', async () => {
    const warn = vi.spyOn(console, 'warn');
    const opened = await openCamera({ cameraAspectRatio: '16:9', cameraAspectRatioOptions: '1:1, 4:3' });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('not in cameraAspectRatioOptions'));
    await opened.settingsButton.click();
    await expect.element(opened.ratioPicker).toHaveValue('1:1');
    const photo = await takePhoto(opened);
    expect(photo.width).toBe(photo.height);
  });

  it('starts over when the config changes', async () => {
    const opened = await openCamera({ cameraAspectRatioOptions: 'native, 1:1, 4:3' });
    await opened.settingsButton.click();
    await opened.ratioPicker.selectOptions('4:3');

    opened.config.cameraAspectRatio = '1:1';

    await expect.element(opened.ratioPicker).toHaveValue('1:1');
  });
});

describe('quality picker', () => {
  it('applies the pick to the open camera without reopening it', async () => {
    const opened = await openCamera({ cameraQualityOptions: 'auto, 720p' });
    const applyConstraints = vi.spyOn(MediaStreamTrack.prototype, 'applyConstraints');
    await opened.settingsButton.click();

    await opened.qualityPicker.selectOptions('720p');

    await vi.waitFor(() =>
      expect(applyConstraints).toHaveBeenCalledWith(
        expect.objectContaining({ width: { ideal: 1280 }, height: { ideal: 720 } }),
      ),
    );
    expect(opened.getUserMedia).toHaveBeenCalledTimes(1);
    expect(opened.config.cameraQuality).toBe('auto');
  });

  it('leaves out presets the camera cannot do', async () => {
    vi.spyOn(MediaStreamTrack.prototype, 'getCapabilities').mockReturnValue({
      width: { max: 1280 },
      height: { max: 720 },
    });
    const opened = await openCamera({ cameraQualityOptions: 'auto, 720p, 1080p, 4k' });

    await opened.settingsButton.click();

    expect(optionTexts(opened.qualityPicker)).toEqual(['Auto', '720P']);
  });
});
