import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { Config, UploadCtxProvider } from '@/index.ts';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

// M9g Task 1 — additive parity e2e pinning current v1 behavior of
// `uc-camera-source` (src/blocks/CameraSource/CameraSource.ts) ahead of its
// `LitUploaderBlock` port. Mounts the regular solution +
// `<uc-upload-ctx-provider>` (same composition as tests/blocks/url-source.e2e.test.tsx)
// and reaches the activity via the real "Camera" start-from button. Chromium
// runs with the fake media-stream flags (vitest.config.ts), so the
// `getUserMedia`/permissions-API 'granted' path works headlessly. Kept
// shallow per the M9g brief — pins the block's own render surface (video
// element + shot button + granted state), not the shot/record/accept bridge
// internals already covered by tests/plugins/camera-source.e2e.test.tsx and
// tests/file-uploader-regular.e2e.test.tsx's "from camera" case.

const renderRegularHost = () => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
      <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
    </>,
  );
  const config = page.getByTestId('uc-config').query()! as Config;
  const provider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
  return { ctxName, config, api: provider.api };
};

const navigateToCameraSource = async () => {
  await page.getByText('Upload files', { exact: true }).click();
  const startFrom = page.getByTestId('uc-start-from');
  await expect.element(startFrom).toBeVisible();
  await startFrom.getByText('Camera', { exact: true }).click();
  const cameraSource = page.getByTestId('uc-camera-source');
  await expect.element(cameraSource).toBeVisible();
  return cameraSource;
};

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

describe('uc-camera-source (parity, render surface + permissions)', () => {
  it('renders the video element and the shot button once permissions are granted', async () => {
    renderRegularHost();
    const cameraSource = await navigateToCameraSource();

    // Permissions flow reaches 'granted' (fake-media-stream Chromium flags):
    // the host gets `.uc-initialized` and the video/shot-button `hidden`
    // attributes clear (CameraSource.ts's `_setPermissionsState('granted')`).
    await expect
      .poll(() => document.querySelector('uc-camera-source')?.classList.contains('uc-initialized'))
      .toBe(true);

    await expect.element(cameraSource.getByTestId('uc-camera-source--shot')).toBeVisible();

    const video = document.querySelector('uc-camera-source video');
    expect(video).toBeTruthy();
    await expect.poll(() => video?.hasAttribute('hidden')).toBe(false);
  });

  it('reflects data-testid under testMode', async () => {
    renderRegularHost();
    await navigateToCameraSource();

    expect(document.querySelector('uc-camera-source')?.getAttribute('data-testid')).toBe('uc-camera-source');
  });
});
