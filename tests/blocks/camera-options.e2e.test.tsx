import { describe, expect, it } from 'vitest';
import type { Config } from '@/index';
import { browserFeatures } from '@/utils/browser-info';
import { expectActivity, openModal, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * Camera-related options, none of which had a test. The chromium instance runs with
 * `--use-fake-device-for-media-stream` (vitest.config.ts), so the camera activity opens with a working stream and
 * these can be asserted on the rendered controls rather than mocked.
 *
 * Nested test ids are prefixed with the host tag by TestModeController, hence `uc-camera-source--tab-photo`.
 */

/** Opens the camera activity and returns the solution root once it is really on screen. */
const openCamera = async (configProps: Partial<Config> = {}) => {
  const rendered = await renderSolution('regular', configProps);
  rendered.api.initFlow();
  await expectActivity(rendered.root, 'start-from');

  await within(rendered.root).getByTestId('uc-start-from').getByText('Camera', { exact: true }).click();
  await expectActivity(rendered.root, 'camera');

  return { ...rendered, camera: within(rendered.root).getByTestId('uc-camera-source') };
};

describe('cameraMirror', () => {
  it('leaves the preview unmirrored by default', async () => {
    const { camera } = await openCamera();

    // The `<video>` carries no test id.
    await expect.poll(() => camera.element().querySelector('video')?.style.transform).toBe('');
  });

  it('mirrors the preview when set', async () => {
    const { camera } = await openCamera({ cameraMirror: true });

    await expect.poll(() => camera.element().querySelector('video')?.style.transform).toBe('scaleX(-1)');
  });
});

describe('enableAudioRecording', () => {
  // The microphone controls belong to video recording: the photo tab forces them hidden regardless of the option
  // (CameraSource.ts:610), and only the video tab consults `enableAudioRecording` (CameraSource.ts:618).
  it('hides the microphone toggle on the photo tab whatever the setting', async () => {
    const { camera } = await openCamera({ enableAudioRecording: true });

    await expect.element(camera.getByTestId('uc-camera-source--toggle-microphone')).not.toBeVisible();
  });

  it('shows the microphone toggle on the video tab, which is the default', async () => {
    const { camera } = await openCamera();
    await camera.getByTestId('uc-camera-source--tab-video').click();

    await expect.element(camera.getByTestId('uc-camera-source--toggle-microphone')).toBeVisible();
  });

  it('hides the microphone toggle on the video tab when disabled', async () => {
    const { camera } = await openCamera({ enableAudioRecording: false });
    await camera.getByTestId('uc-camera-source--tab-video').click();

    await expect.element(camera.getByTestId('uc-camera-source--toggle-microphone')).not.toBeVisible();
  });
});

describe('cameraModes', () => {
  it('offers both tabs by default', async () => {
    const { camera } = await openCamera();

    await expect.element(camera.getByTestId('uc-camera-source--tab-photo')).toBeVisible();
    await expect.element(camera.getByTestId('uc-camera-source--tab-video')).toBeVisible();
  });

  it('hides the video tab when only photo is allowed', async () => {
    const { camera } = await openCamera({ cameraModes: 'photo' });

    await expect.element(camera.getByTestId('uc-camera-source--tab-video')).not.toBeVisible();
  });

  it('hides the photo tab when only video is allowed', async () => {
    const { camera } = await openCamera({ cameraModes: 'video' });

    await expect.element(camera.getByTestId('uc-camera-source--tab-photo')).not.toBeVisible();
  });
});

describe('enableVideoRecording (deprecated)', () => {
  // The option is documented as deprecated in favour of `cameraModes`, and feeds it through a computed property
  // (Config/computed-properties.ts:41): `false` strips `video` from the mode list, `true` adds it.
  it('drops the video tab when disabled', async () => {
    const { camera } = await openCamera({ enableVideoRecording: false });

    await expect.element(camera.getByTestId('uc-camera-source--tab-video')).not.toBeVisible();
  });

  it('leaves both tabs when enabled', async () => {
    const { camera } = await openCamera({ enableVideoRecording: true });

    await expect.element(camera.getByTestId('uc-camera-source--tab-video')).toBeVisible();
    await expect.element(camera.getByTestId('uc-camera-source--tab-photo')).toBeVisible();
  });
});

describe('defaultCameraMode', () => {
  it('opens on the photo tab by default', async () => {
    const { camera } = await openCamera();

    await expect.element(camera.getByTestId('uc-camera-source--tab-photo')).toHaveClass('uc-active');
  });

  it('opens on video when asked', async () => {
    const { camera } = await openCamera({ defaultCameraMode: 'video' });

    await expect.element(camera.getByTestId('uc-camera-source--tab-video')).toHaveClass('uc-active');
  });
});

describe('htmlMediaCapture', () => {
  it('offers Photo and Video buttons on mobile', async () => {
    const original = browserFeatures.htmlMediaCapture;
    (browserFeatures as { htmlMediaCapture: boolean }).htmlMediaCapture = true;

    try {
      const { root } = await renderSolution('regular');
      await openModal(root);

      await expect.element(within(root).getByText('Photo')).toBeVisible();
      await expect.element(within(root).getByText('Video')).toBeVisible();
    } finally {
      (browserFeatures as { htmlMediaCapture: boolean }).htmlMediaCapture = original;
    }
  });
});
