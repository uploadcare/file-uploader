import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { Config } from '@/index';
import { expectActivity, renderSolution } from './utils/render-solution';
import '../types/jsx';

/**
 * Camera-related options, none of which had a test. The chromium instance runs with
 * `--use-fake-device-for-media-stream` (vitest.config.ts), so the camera activity opens with a working stream and
 * these can be asserted on the rendered controls rather than mocked.
 *
 * Nested test ids are prefixed with the host tag by TestModeController, hence `uc-camera-source--tab-photo`.
 */

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

/** Opens the camera activity and returns the solution root once it is really on screen. */
const openCamera = async (configProps: Partial<Config> = {}) => {
  const rendered = await renderSolution('regular', configProps);
  rendered.api.initFlow();
  await expectActivity(rendered.root, 'start-from');

  await page.getByTestId('uc-start-from').getByText('Camera', { exact: true }).click();
  await expectActivity(rendered.root, 'camera');

  return rendered;
};

describe('cameraMirror', () => {
  it('leaves the preview unmirrored by default', async () => {
    const { root } = await openCamera();

    await expect.poll(() => root.querySelector<HTMLVideoElement>('uc-camera-source video')?.style.transform).toBe('');
  });

  it('mirrors the preview when set', async () => {
    const { root } = await openCamera({ cameraMirror: true });

    await expect
      .poll(() => root.querySelector<HTMLVideoElement>('uc-camera-source video')?.style.transform)
      .toBe('scaleX(-1)');
  });
});

describe('enableAudioRecording', () => {
  // The microphone controls belong to video recording: the photo tab forces them hidden regardless of the option
  // (CameraSource.ts:610), and only the video tab consults `enableAudioRecording` (CameraSource.ts:618).
  const openVideoTab = async () => {
    await page.getByTestId('uc-camera-source--tab-video').click();
  };

  it('hides the microphone toggle on the photo tab whatever the setting', async () => {
    await openCamera({ enableAudioRecording: true });

    await expect.element(page.getByTestId('uc-camera-source--toggle-microphone')).not.toBeVisible();
  });

  it('shows the microphone toggle on the video tab, which is the default', async () => {
    await openCamera();
    await openVideoTab();

    await expect.element(page.getByTestId('uc-camera-source--toggle-microphone')).toBeVisible();
  });

  it('hides the microphone toggle on the video tab when disabled', async () => {
    await openCamera({ enableAudioRecording: false });
    await openVideoTab();

    await expect.element(page.getByTestId('uc-camera-source--toggle-microphone')).not.toBeVisible();
  });
});

describe('cameraModes', () => {
  it('offers both tabs by default', async () => {
    await openCamera();

    await expect.element(page.getByTestId('uc-camera-source--tab-photo')).toBeVisible();
    await expect.element(page.getByTestId('uc-camera-source--tab-video')).toBeVisible();
  });

  it('hides the video tab when only photo is allowed', async () => {
    await openCamera({ cameraModes: 'photo' });

    await expect.element(page.getByTestId('uc-camera-source--tab-video')).not.toBeVisible();
  });

  it('hides the photo tab when only video is allowed', async () => {
    await openCamera({ cameraModes: 'video' });

    await expect.element(page.getByTestId('uc-camera-source--tab-photo')).not.toBeVisible();
  });
});

describe('enableVideoRecording (deprecated)', () => {
  // The option is documented as deprecated in favour of `cameraModes`, and feeds it through a computed property
  // (Config/computed-properties.ts:41): `false` strips `video` from the mode list, `true` adds it.
  it('drops the video tab when disabled', async () => {
    await openCamera({ enableVideoRecording: false });

    await expect.element(page.getByTestId('uc-camera-source--tab-video')).not.toBeVisible();
  });

  it('leaves both tabs when enabled', async () => {
    await openCamera({ enableVideoRecording: true });

    await expect.element(page.getByTestId('uc-camera-source--tab-video')).toBeVisible();
    await expect.element(page.getByTestId('uc-camera-source--tab-photo')).toBeVisible();
  });
});

describe('defaultCameraMode', () => {
  it('opens on the photo tab by default', async () => {
    const { root } = await openCamera();

    await expect
      .poll(() => root.querySelector('[data-testid="uc-camera-source--tab-photo"]')?.classList.contains('uc-active'))
      .toBe(true);
  });

  it('opens on video when asked', async () => {
    const { root } = await openCamera({ defaultCameraMode: 'video' });

    await expect
      .poll(() => root.querySelector('[data-testid="uc-camera-source--tab-video"]')?.classList.contains('uc-active'))
      .toBe(true);
  });
});
