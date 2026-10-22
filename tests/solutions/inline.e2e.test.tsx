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

  it('wraps the source buttons by default and lays them into the parent when sourceListWrap is off', async () => {
    const wrapped = await renderSolution('inline');
    const unwrapped = await renderSolution('inline', { sourceListWrap: false });
    const display = (root: HTMLElement) => () =>
      getComputedStyle(within(root).getByTestId('uc-source-list').element()).display;

    await expect.poll(display(unwrapped.root)).toBe('contents');
    expect(display(wrapped.root)()).not.toBe('contents');
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

  it('renders the drop area, source list and upload list in place, with no modal', async () => {
    const { root } = await renderSolution('inline');

    await expect.element(within(root).getByTestId('uc-drop-area').first()).toBeVisible();
    await expect.element(within(root).getByTestId('uc-source-list')).toBeVisible();
    expect(within(root).getByTestId('uc-upload-list').query()).not.toBeNull();
    expect(within(root).getByTestId('uc-modal').query()).toBeNull();
  });
});
