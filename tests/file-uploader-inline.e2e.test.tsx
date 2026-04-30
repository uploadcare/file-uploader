import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

beforeEach(() => {
  const ctxName = `test-${Math.random().toString(36).slice(2)}`;
  page.render(
    <>
      <uc-file-uploader-inline ctx-name={ctxName}></uc-file-uploader-inline>
      <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
});

describe('File uploader inline', () => {
  it('should be rendered', async () => {
    await expect.element(page.getByTestId('uc-start-from').getByText('Drop files here', { exact: true })).toBeVisible();
  });

  it('should open the url source, when clicked', async () => {
    await page.getByText('From link', { exact: true }).click();
    const urlSource = page.getByTestId('uc-url-source');
    await expect(urlSource).toBeDefined();
  });

  it('should open the camera source, when clicked', async () => {
    // Intentionally do not test full recording/accept flow here:
    // media-recorder interactions are flaky in CI and may close the browser connection.
    // This test focuses on camera source availability and primary controls rendering.
    await page.getByTestId('uc-start-from').getByText('Camera', { exact: true }).click();

    const cameraSource = page.getByTestId('uc-camera-source');
    await expect.element(cameraSource).toBeVisible();

    const tabVideo = cameraSource.getByTestId('uc-camera-source--tab-video');
    await userEvent.click(tabVideo);
    await expect(tabVideo).toHaveClass('uc-active');

    const toggleMicrophone = cameraSource.getByTestId('uc-camera-source--toggle-microphone');
    await expect(toggleMicrophone).toBeVisible();

    const shot = cameraSource.getByTestId('uc-camera-source--shot');
    await expect(shot).toBeDefined();
  });
});
