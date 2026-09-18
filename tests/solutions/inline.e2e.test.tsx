import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '~/types/jsx';
import { renderSolution, within } from '~/tests/utils/render-solution';

describe('uc-file-uploader-inline', () => {
  it('renders start-from inline', async () => {
    const { root } = await renderSolution('inline');

    await expect
      .element(within(root).getByTestId('uc-start-from').getByText('Drop files here', { exact: true }))
      .toBeVisible();
  });

  it('opens the url source when clicked', async () => {
    const { root } = await renderSolution('inline');

    await within(root).getByText('From link', { exact: true }).click();

    await expect.element(within(root).getByTestId('uc-url-source')).toBeVisible();
  });

  it('opens the camera source when clicked', async () => {
    // Intentionally do not test full recording/accept flow here:
    // media-recorder interactions are flaky in CI and may close the browser connection.
    // This test focuses on camera source availability and primary controls rendering.
    const { root } = await renderSolution('inline');
    await within(root).getByTestId('uc-start-from').getByText('Camera', { exact: true }).click();

    const cameraSource = within(root).getByTestId('uc-camera-source');
    await expect.element(cameraSource).toBeVisible();

    const tabVideo = cameraSource.getByTestId('uc-camera-source--tab-video');
    await userEvent.click(tabVideo);
    await expect.element(tabVideo).toHaveClass('uc-active');

    await expect.element(cameraSource.getByTestId('uc-camera-source--toggle-microphone')).toBeVisible();
    await expect.element(cameraSource.getByTestId('uc-camera-source--shot')).toBeInTheDocument();
  });
});
