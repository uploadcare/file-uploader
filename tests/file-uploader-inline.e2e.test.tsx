import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '../types/jsx';
import { delay } from '@/utils/delay';
// biome-ignore lint/correctness/noUnusedImports: Used in JSX
import { renderer } from './utils/test-renderer';

beforeAll(async () => {
  // biome-ignore lint/suspicious/noTsIgnore: Ignoring TypeScript error for CSS import
  // @ts-ignore
  await import('@/solutions/file-uploader/inline/index.css');
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
    await page.getByTestId('uc-start-from').getByText('Camera', { exact: true }).click();
    const cameraSource = page.getByTestId('uc-camera-source');
    await expect(cameraSource).toBeDefined();

    const tabVideo = cameraSource.getByTestId('uc-camera-source--tab-video');
    const toggleMicrophone = cameraSource.getByTestId('uc-camera-source--toggle-microphone');

    await userEvent.click(tabVideo);

    await expect(tabVideo).toHaveClass('uc-active');
    await expect(toggleMicrophone).toBeVisible();

    const shot = cameraSource.getByTestId('uc-camera-source--shot');
    await userEvent.click(shot);

    await userEvent.click(toggleMicrophone);
    await delay(2000);
    await userEvent.click(toggleMicrophone);

    await userEvent.click(shot);

    const recordingTimer = cameraSource.getByTestId('uc-camera-source--recording-timer');
    await expect(recordingTimer).toBeVisible();

    const accptButton = cameraSource.getByTestId('uc-camera-source--accept');
    await userEvent.click(accptButton);

    const uploadList = page.getByTestId('uc-upload-list');
    await expect(uploadList).toBeVisible();
  });
});
