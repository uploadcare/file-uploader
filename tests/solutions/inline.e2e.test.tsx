import { describe, expect, it, onTestFinished, vi } from 'vitest';
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

    await within(root).getByRole('button', { name: 'From link', exact: true }).click();

    await expect.element(within(root).getByTestId('uc-url-source')).toBeVisible();
  });

  it('opens the camera source when clicked', async () => {
    // Intentionally do not test full recording/accept flow here:
    // media-recorder interactions are flaky in CI and may close the browser connection.
    // This test focuses on camera source availability and primary controls rendering.
    const { root } = await renderSolution('inline');
    await within(root).getByTestId('uc-start-from').getByRole('button', { name: 'Camera', exact: true }).click();

    const cameraSource = within(root).getByTestId('uc-camera-source');
    await expect.element(cameraSource).toBeVisible();

    const tabVideo = cameraSource.getByRole('button', { name: 'Video', exact: true });
    await userEvent.click(tabVideo);
    await expect.element(tabVideo).toHaveAttribute('aria-pressed', 'true');

    await expect.element(cameraSource.getByTestId('uc-camera-controls--toggle-microphone')).toBeVisible();
    // In video mode the shutter is named for recording.
    await expect.element(cameraSource.getByRole('button', { name: 'Record Video', exact: true })).toBeInTheDocument();
  });

  it('renders the drop area, source list and upload list in place, with no modal', async () => {
    const { root } = await renderSolution('inline');

    await expect.element(within(root).getByTestId('uc-drop-area').first()).toBeVisible();
    await expect.element(within(root).getByTestId('uc-source-list')).toBeVisible();
    expect(within(root).getByTestId('uc-upload-list').query()).not.toBeNull();
    expect(within(root).getByTestId('uc-modal').query()).toBeNull();
  });

  it('keeps its activity and warns on setModalState(false), since it has no modal to close', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());
    const { api, root } = await renderSolution('inline');
    await within(root).getByRole('button', { name: 'From link', exact: true }).click();
    await expect.element(within(root).getByTestId('uc-url-source')).toBeVisible();

    api.setModalState(false);

    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('[uc]'),
        expect.stringContaining('setModalState(false)'),
      ),
    );
    await expect.element(within(root).getByTestId('uc-url-source')).toBeVisible();
  });

  it('switches the visible activity on setCurrentActivity after setModalState(true), since it has no modal to open', async () => {
    const { api, root } = await renderSolution('inline');
    const modalOpen = vi.fn();
    onTestFinished(api.on('modal-open', modalOpen));

    api.setCurrentActivity('url');
    api.setModalState(true);
    await expect.element(within(root).getByTestId('uc-url-source')).toBeVisible();

    api.setCurrentActivity('start-from');

    await expect.element(within(root).getByTestId('uc-start-from')).toBeVisible();
    await expect.element(within(root).getByTestId('uc-url-source')).not.toBeInTheDocument();
    expect(api.getCurrentActivity()).toBe('start-from');
    expect(modalOpen).not.toHaveBeenCalled();
  });

  it('keeps switching the visible activity after initFlow with a single unregistered source, since it has no modal to open', async () => {
    const { api, config, root } = await renderSolution('inline', { sourceList: 'not-a-source' });
    const modalOpen = vi.fn();
    onTestFinished(api.on('modal-open', modalOpen));

    api.initFlow();
    // Enable the url source afterwards, so there is an activity to switch to.
    config.sourceList = 'local, url';
    api.setCurrentActivity('url');

    await expect.element(within(root).getByTestId('uc-url-source')).toBeVisible();
    expect(api.getCurrentActivity()).toBe('url');
    expect(modalOpen).not.toHaveBeenCalled();
  });
});
