import { DEMO_IMAGE_UUID, EDITOR_IMAGE_UUID } from '@uploadcare/api-emulator';
import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { activeClass, networkSplashVisible } from '@/blocks/CloudImageEditor/src/__tests__/editor-fixtures';
import type { CloudImageEditorBlock } from '@/blocks/CloudImageEditor/src/CloudImageEditorBlock';
import type { CloudImageEditorController } from '@/blocks/CloudImageEditor/src/CloudImageEditorController';
import type { ApplyResult } from '@/blocks/CloudImageEditor/src/types';
import '~/types/jsx';
import { within } from '~/tests/utils/render-solution';

/**
 * How the editor's shared state reaches its blocks: what a write to the editor controller re-renders or sets off, and
 * the root's own writes when its inputs change. A standalone editor, so config and locale come from its own props.
 */
const renderEditor = (image: { uuid: string } | { 'cdn-url': string } = { uuid: EDITOR_IMAGE_UUID }) => {
  page.render(
    'cdn-url' in image ? (
      <uc-cloud-image-editor
        cdn-url={image['cdn-url']}
        crop-preset="1:1, 16:9, 4:3"
        cdn-cname="https://ucarecdn.com/"
        test-mode
      ></uc-cloud-image-editor>
    ) : (
      <uc-cloud-image-editor
        uuid={image.uuid}
        crop-preset="1:1, 16:9, 4:3"
        cdn-cname="https://ucarecdn.com/"
        test-mode
      ></uc-cloud-image-editor>
    ),
  );
  const element = document.querySelector<CloudImageEditorBlock>('uc-cloud-image-editor')!;
  return { element, editor: within(element) };
};

/** The root's private controller: the state these tests write to stand in for a block's own write. */
const controllerOf = (element: CloudImageEditorBlock) =>
  (element as unknown as { _editorController: CloudImageEditorController })._editorController;

/** Resolves once the next `updateImage` call (an image attribute change) has settled. */
const updateImageSettled = (element: CloudImageEditorBlock) => {
  const updateImage = vi.spyOn(element, 'updateImage');
  return async () => {
    await expect.poll(() => updateImage.mock.calls.length).toBe(1);
    await updateImage.mock.results[0]?.value;
  };
};

const cropperActive = (element: HTMLElement) =>
  expect.poll(() => activeClass(element.querySelector('uc-editor-image-cropper'))).toMatch(/uc-active_from_/);

const faderActive = (element: HTMLElement) =>
  expect
    .poll(() => activeClass(element.querySelector('uc-editor-image-fader')), { timeout: 5000 })
    .toMatch(/uc-active_from_/);

const onApply = (element: HTMLElement) => {
  const applied: ApplyResult[] = [];
  element.addEventListener('apply', (event) => applied.push((event as CustomEvent<ApplyResult>).detail));
  return applied;
};

const openBrightness = async (element: HTMLElement, editor: ReturnType<typeof within>) => {
  await userEvent.click(editor.getByRole('tab', { name: /tuning/i }));
  await faderActive(element);
  await userEvent.click(editor.getByRole('option', { name: /Brightness/i }));
  const slider = editor.getByTestId('uc-editor-slider');
  await expect.element(slider).toBeVisible();
  return slider;
};

describe('editor state reactions', () => {
  it('relabels its controls when localeDefinition changes after mount', async () => {
    const { element, editor } = renderEditor();
    await expect.element(editor.getByRole('option', { name: 'Apply rotate operation' })).toBeVisible();

    element.localeDefinition = { 'a11y-cloud-editor-apply-crop': 'Do {{name}}' };

    await expect.element(editor.getByRole('option', { name: 'Do rotate' })).toBeVisible();
  });

  it('applies a mirror clicked once', async () => {
    const { element, editor } = renderEditor();
    await cropperActive(element);
    const applied = onApply(element);

    // Mirror is the second crop button.
    await userEvent.click(editor.getByTestId('uc-editor-crop-button-control').nth(1));
    await userEvent.click(editor.getByRole('button', { name: /apply/i }));

    await expect.poll(() => applied.at(-1)?.transformations.mirror).toBe(true);
  });

  it('keeps the current preset selected when it is picked again', async () => {
    const { element, editor } = renderEditor();
    await cropperActive(element);
    await userEvent.click(editor.getByRole('option', { name: 'Crop to 1:1', exact: true }));
    const preset1x1 = editor.getByRole('option', { name: /^Apply operation crop to 1:1/ });
    await expect.element(preset1x1).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(preset1x1);

    await expect.element(preset1x1).toHaveAttribute('aria-selected', 'true');
    expect(controllerOf(element).currentAspectRatio).toMatchObject({ width: 1, height: 1 });
  });

  it('switches to the first listed tab when the tabs no longer include the current one', async () => {
    const { element, editor } = renderEditor();
    await cropperActive(element);

    element.setAttribute('tabs', 'tuning, filters');

    await expect.element(editor.getByRole('tab', { name: /tuning/i, selected: true })).toBeVisible();
    expect(controllerOf(element).tabId).toBe('tuning');
    await faderActive(element);
  });

  it('drops the live preview when the slider is cancelled', async () => {
    const { element, editor } = renderEditor();
    const slider = await openBrightness(element, editor);
    await userEvent.click(slider);
    await userEvent.keyboard('[ArrowRight]');
    await expect.poll(() => controllerOf(element).colorPreview?.operation).toBe('brightness');

    const sliderCancel = element.querySelector<HTMLElement>('.uc-controls-row uc-btn-ui[theme="secondary"] button')!;
    await userEvent.click(sliderCancel);

    await expect.poll(() => controllerOf(element).colorPreview).toBeNull();
    expect(controllerOf(element).editorTransformations.brightness).toBeUndefined();
  });

  it('adds a fader keypoint once the slider rests on a new value', async () => {
    const { element, editor } = renderEditor();
    const slider = await openBrightness(element, editor);
    const fader = element.querySelector('uc-editor-image-fader')!;
    const keypointImages = () => fader.querySelectorAll('img.uc-fader-image').length;
    await expect.poll(keypointImages).toBeGreaterThan(0);
    const before = keypointImages();

    await userEvent.click(slider);
    await userEvent.keyboard('[ArrowRight]');

    await expect.poll(keypointImages).toBe(before + 1);
  });

  it('reloads the loaded filter previews once the network problems clear', async () => {
    const { element, editor } = renderEditor();
    await cropperActive(element);
    await userEvent.click(editor.getByRole('tab', { name: /filters/i }));
    const thumbnail = editor.getByTestId('uc-editor-filter-control').nth(1);
    await expect.element(thumbnail).toBeVisible();
    await expect.poll(() => thumbnail.element().querySelector('.uc-preview')?.hasAttribute('data-loaded')).toBe(true);
    const controller = controllerOf(element);
    controller.networkProblems = true;
    const proxyUrl = vi.spyOn(controller, 'proxyUrl');

    controller.networkProblems = false;

    await expect
      .poll(() => proxyUrl.mock.calls.filter(([url]) => url.includes('scale_crop')).length)
      .toBeGreaterThan(0);
  });

  it('clears the transformations and source operations of the previous image when a uuid replaces a cdn-url', async () => {
    const { element, editor } = renderEditor({
      'cdn-url': `https://ucarecdn.com/${EDITOR_IMAGE_UUID}/-/rotate/90/-/blur/20/`,
    });
    await cropperActive(element);
    expect(controllerOf(element).editorTransformations.rotate).toBe(90);
    expect(controllerOf(element).sourceOperations.length).toBeGreaterThan(0);
    const applied = onApply(element);

    element.removeAttribute('cdn-url');
    element.setAttribute('uuid', DEMO_IMAGE_UUID);
    await expect.poll(() => controllerOf(element).originalUrl).toContain(DEMO_IMAGE_UUID);
    await cropperActive(element);
    expect(controllerOf(element).sourceOperations).toEqual([]);

    await userEvent.click(editor.getByRole('button', { name: /apply/i }));
    await expect.poll(() => applied.length).toBe(1);
    expect(applied[0]?.transformations.rotate ?? 0).toBe(0);
    expect(applied[0]?.cdnUrl).toContain(DEMO_IMAGE_UUID);
    expect(applied[0]?.cdnUrl).not.toContain('blur');
  });

  it('drops a live color preview when a new image arrives', async () => {
    const { element, editor } = renderEditor();
    const slider = await openBrightness(element, editor);
    await userEvent.click(slider);
    await userEvent.keyboard('[ArrowRight]');
    await expect.poll(() => controllerOf(element).colorPreview).not.toBeNull();

    element.setAttribute('uuid', DEMO_IMAGE_UUID);

    await expect.poll(() => controllerOf(element).originalUrl).toContain(DEMO_IMAGE_UUID);
    expect(controllerOf(element).colorPreview).toBeNull();
  });

  it('shows the network problems screen when the state says so and Retry clears it with the image loaded', async () => {
    const { element, editor } = renderEditor();
    await cropperActive(element);

    controllerOf(element).networkProblems = true;
    await expect.poll(() => networkSplashVisible(element)).toBe(true);

    await editor.getByText('Retry').click();

    await expect.poll(() => networkSplashVisible(element)).toBe(false);
    expect(controllerOf(element).networkProblems).toBe(false);
    await cropperActive(element);
  });

  it('dispatches cancel from the toolbar Cancel button and removes itself', async () => {
    const { element } = renderEditor();
    await cropperActive(element);
    const cancelled = vi.fn();
    element.addEventListener('cancel', cancelled);

    const cancel = element.querySelector<HTMLElement>('uc-editor-toolbar uc-btn-ui[icon="closeMax"] button')!;
    await userEvent.click(cancel);

    await expect.poll(() => cancelled.mock.calls.length).toBe(1);
    expect(element.isConnected).toBe(false);
  });

  it('keeps the open image when a uuid names the image a cdn-url already opened', async () => {
    const { element } = renderEditor({ 'cdn-url': `https://ucarecdn.com/${EDITOR_IMAGE_UUID}/` });
    await cropperActive(element);
    const controller = controllerOf(element);
    const originalUrl = controller.originalUrl;
    const fetchSpy = vi.spyOn(window, 'fetch');
    const updated = updateImageSettled(element);

    element.removeAttribute('cdn-url');
    element.setAttribute('uuid', EDITOR_IMAGE_UUID);
    // A reload would have requested the image info before `updateImage` settled.
    await updated();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(controller.originalUrl).toBe(originalUrl);
  });

  it('ignores the operations of a cdn-url that names the image already open', async () => {
    const { element } = renderEditor({ 'cdn-url': `https://ucarecdn.com/${EDITOR_IMAGE_UUID}/` });
    await cropperActive(element);
    const controller = controllerOf(element);
    const updated = updateImageSettled(element);

    element.setAttribute('cdn-url', `https://ucarecdn.com/${EDITOR_IMAGE_UUID}/-/rotate/90/`);
    await updated();

    // QUIRK(cloud-image-editor): `updateImage` returns early when the parsed original URL is unchanged
    // (CloudImageEditorBlock.ts `originalUrl === …originalUrl` check), so a cdn-url carrying new operations for the
    // open image is dropped. Pinned as current behaviour, not endorsed.
    expect(controller.editorTransformations.rotate ?? 0).toBe(0);
    expect(controller.sourceOperations).toEqual([]);
  });

  it('shows the network problems screen when a filter preview URL cannot be resolved', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { element, editor } = renderEditor();
    await cropperActive(element);
    const controller = controllerOf(element);
    const proxyUrl = controller.proxyUrl.bind(controller);
    vi.spyOn(controller, 'proxyUrl').mockImplementation((url) =>
      url.includes('scale_crop') ? Promise.reject(new Error('offline')) : proxyUrl(url),
    );

    await userEvent.click(editor.getByRole('tab', { name: /filters/i }));

    await expect.poll(() => networkSplashVisible(element)).toBe(true);
    expect(controller.networkProblems).toBe(true);
  });
});
