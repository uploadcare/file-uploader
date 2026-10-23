import { DEMO_IMAGE_UUID, EDITOR_IMAGE_UUID } from '@uploadcare/api-emulator';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { EditorImageFader } from '@/blocks/CloudImageEditor/src/EditorImageFader';
import { SliderUi } from '@/blocks/CloudImageEditor/src/elements/slider/SliderUi';
import type { ApplyResult } from '@/blocks/CloudImageEditor/src/types';
import { delay } from '@/utils/delay';
import '~/types/jsx';
import { withResolvers } from '@/utils/withResolvers';
import type { TelemetryBody } from '~/tests/api/telemetry/sink';
import { emulatorSession, isLive } from '~/tests/utils/emulator.browser';
import { createInCtx, inCtx, within } from '~/tests/utils/render-solution';
import { getCtxName } from '~/tests/utils/test-renderer';

const UUID = EDITOR_IMAGE_UUID;
const GROUP_CDN_URL = `https://ucarecdn.com/${UUID}~3/`;

/** What the editor reports when it cannot load the image's info. */
const IMAGE_INFO_ERROR = 'Error in cloud editor image. Failed to load image info';

/**
 * `<uc-cloud-image-editor>` is not part of any solution, so it is rendered by hand with its own config. The image
 * defaults to `uuid`; pass `cdn-url` instead to open one carrying operations.
 */
const renderEditor = (image: Record<string, string> = { uuid: UUID }, { qualityInsights = false } = {}) => {
  const ctxName = getCtxName();
  const element = createInCtx<HTMLElement>('uc-cloud-image-editor', ctxName, {
    'crop-preset': '1:1, 16:9, 4:3, 3:4, 9:16',
    ...image,
  });
  const config = createInCtx('uc-config', ctxName, {
    'cdn-cname': 'https://ucarecdn.com/',
    'quality-insights': String(qualityInsights),
    pubkey: 'demopublickey',
    'test-mode': 'true',
  });
  page.render(<div ctx-name={ctxName}></div>);
  inCtx('div', ctxName).append(element, config);
  return { element, editor: within(element) };
};

/** Activation draws the image and marks the element `uc-active_from_*`, so the class is the "it really works" signal. */
const activeClass = (element: Element | null | undefined) => element?.className ?? '';

describe('uc-cloud-image-editor', () => {
  it('renders', async () => {
    const { element } = renderEditor();

    await expect.element(element).toBeVisible();
  });

  it('accepts a click on a crop control', async () => {
    const { editor } = renderEditor();
    const flip = editor.getByTestId('uc-editor-crop-button-control').nth(2);

    await userEvent.click(flip);
  });

  it('selects a crop preset', async () => {
    const { editor } = renderEditor();
    // The preset menu's button is named after the current preset, the first in `crop-preset`.
    await userEvent.click(editor.getByRole('option', { name: 'Crop to 1:1', exact: true }));

    const preset16x9 = editor.getByRole('option', { name: /^Apply operation crop to 16:9/ });
    await userEvent.click(preset16x9);
    await expect.element(preset16x9).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(editor.getByRole('button', { name: /apply/i }));

    await expect.element(editor.getByRole('option', { name: 'Crop to 16:9', exact: true })).toBeVisible();
  });

  it("applies the 'brightness' operation", async () => {
    const { editor } = renderEditor();
    const tuningTab = editor.getByRole('tab', { name: /tuning/i });
    await userEvent.click(tuningTab);

    await userEvent.click(editor.getByRole('option', { name: /Brightness/i }));

    const slider = editor.getByTestId('uc-editor-slider');
    await expect.element(slider).toBeVisible();

    await userEvent.click(slider);
    await userEvent.keyboard('[ArrowRight]');
    await userEvent.click(editor.getByRole('button', { name: /apply/i }));

    await expect.element(tuningTab).toBeVisible();
  });

  it('names its slider after the operation', async () => {
    const { editor } = renderEditor();
    await userEvent.click(editor.getByRole('tab', { name: /tuning/i }));

    await userEvent.click(editor.getByRole('option', { name: /Brightness/i }));

    await expect.element(editor.getByRole('slider', { name: 'Brightness' })).toBeVisible();
  });

  it('exposes its tab toggles as focusable tabs in a tablist of tabs only', async () => {
    const { element, editor } = renderEditor();
    const tuningTab = editor.getByRole('tab', { name: /tuning/i });
    await userEvent.click(tuningTab);

    await expect.element(editor.getByRole('tab', { name: /tuning/i, selected: true })).toBeVisible();
    await expect.element(editor.getByRole('tab', { name: /crop/i, selected: false })).toBeVisible();
    expect(tuningTab.element().tagName).toBe('BUTTON');
    const tablist = editor.getByRole('tablist').element();
    expect(tablist.querySelector('.uc-tab-content')).toBeNull();
    // Every tab's aria-controls points at a panel that exists.
    for (const tab of element.querySelectorAll('[role="tab"][aria-controls]')) {
      expect(document.getElementById(tab.getAttribute('aria-controls') ?? '')).not.toBeNull();
    }
  });

  // Fake-only: the image info request is held at the emulator, and a live run has none.
  it.skipIf(isLive)('reports nothing once removed while its image info request is in flight', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Reporting from a removed editor would throw, as its shared context is gone, and nothing would catch it.
    const rejections: unknown[] = [];
    const onRejection = (event: PromiseRejectionEvent) => rejections.push(event.reason);
    window.addEventListener('unhandledrejection', onRejection);
    onTestFinished(() => window.removeEventListener('unhandledrejection', onRejection));
    const released = withResolvers();
    const held = new Set<string>();
    emulatorSession().on('GET /:uuid/-/json/', async ({ params }) => {
      held.add(params.uuid);
      await released.promise;
      return new Response('not json', { status: 500 });
    });
    const removed = renderEditor(undefined, { qualityInsights: true });
    // Gets the same failed answer while still on the page, so it does report, and that report is the sign the
    // removed editor's answer has landed too.
    renderEditor({ uuid: DEMO_IMAGE_UUID }, { qualityInsights: true });
    await expect.poll(() => [...held].sort()).toEqual([DEMO_IMAGE_UUID, EDITOR_IMAGE_UUID].sort());

    removed.element.parentElement?.remove();
    released.resolve();

    const imageInfoLogs = () => errorSpy.mock.calls.filter((args) => args.includes('Failed to load image info'));
    const imageInfoErrors = () =>
      (emulatorSession().telemetry as TelemetryBody[]).filter(
        (body) => body.payload.metadata?.text === IMAGE_INFO_ERROR,
      );
    await expect.poll(() => imageInfoErrors().length).toBe(1);
    expect(imageInfoLogs()).toHaveLength(1);
    expect(rejections).toEqual([]);
  });

  // Fake-only: the first image's info request is held at the emulator.
  it.skipIf(isLive)('keeps the size of the current image when an older image info response lands last', async () => {
    const released = withResolvers();
    const parsed = withResolvers();
    // Marks when the editor has parsed the held body: the point after which it would apply it.
    const json = Response.prototype.json;
    vi.spyOn(Response.prototype, 'json').mockImplementation(async function (this: Response) {
      const value = await json.call(this);
      if (this.url.includes(EDITOR_IMAGE_UUID)) parsed.resolve();
      return value;
    });
    let held = false;
    emulatorSession().on('GET /:uuid/-/json/', async ({ params }) => {
      if (params.uuid === EDITOR_IMAGE_UUID) {
        held = true;
        await released.promise;
        return Response.json({ width: 11, height: 11 });
      }
      return Response.json({ width: 640, height: 480 });
    });
    const { element } = renderEditor();
    const cropperSize = () =>
      (element.querySelector('uc-editor-image-cropper') as { imageSize?: { width: number } } | null)?.imageSize;
    await expect.poll(() => held).toBe(true);

    element.setAttribute('uuid', DEMO_IMAGE_UUID);
    await expect.poll(() => cropperSize()?.width).toBe(640);
    released.resolve();
    // The sentinel: the held body is parsed; a task later anything that would apply it has run.
    await parsed.promise;
    await delay(0);
    await (element as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;

    expect(cropperSize()?.width).toBe(640);
  });

  // Fake-only: the error answer comes from the emulator.
  it.skipIf(isLive)('reports a failed image info request even when the error body is JSON', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    emulatorSession().on('GET /:uuid/-/json/', () => Response.json({ detail: 'Not found.' }, { status: 404 }));
    renderEditor();

    await expect
      .poll(() => errorSpy.mock.calls.filter((args) => args.includes('Failed to load image info')))
      .toHaveLength(1);
  });

  it('logs a timeout without an unhandled rejection when the container size stays zero', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const ctxName = getCtxName();
    page.render(
      <>
        <div style="width: 0; height: 0; overflow: hidden;">
          <uc-cloud-image-editor
            crop-preset="1:1, 16:9, 4:3, 3:4, 9:16"
            uuid={EDITOR_IMAGE_UUID}
            ctx-name={ctxName}
          ></uc-cloud-image-editor>
        </div>
        <uc-config
          cdn-cname="https://ucarecdn.com/"
          quality-insights="false"
          ctx-name={ctxName}
          pubkey="demopublickey"
          testMode
        ></uc-config>
      </>,
    );

    // The editor gives up on a zero-sized container after its own 3s timeout, so the log is the signal.
    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled(), { timeout: 5000 });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      '[uc][cloud-image-editor]',
      '[cloud-image-editor] timeout waiting for non-zero container size',
    );
  });

  // Fake-only: the image sizes come from the emulator.
  it.skipIf(isLive)('waits for a size again when a new image arrives after the editor lost its size', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    emulatorSession().on('GET /:uuid/-/json/', ({ params }) =>
      Response.json(params.uuid === DEMO_IMAGE_UUID ? { width: 640, height: 480 } : { width: 300, height: 200 }),
    );
    const { element, editor } = renderEditor();
    const cropper = editor.getByTestId('uc-editor-image-cropper');
    await expect.poll(() => activeClass(cropper.element())).toMatch(/uc-active_from_/);
    // A new image while the editor has its size: this wait sees the size at once.
    const imageSize = () =>
      (element.querySelector('uc-editor-image-cropper') as { imageSize?: { width: number } } | null)?.imageSize;
    element.setAttribute('uuid', DEMO_IMAGE_UUID);
    await expect.poll(() => imageSize()?.width).toBe(640);

    element.style.display = 'none';
    element.setAttribute('uuid', EDITOR_IMAGE_UUID);

    // The editor gives up on a zero-sized container after its own 3s timeout, so the log is the signal.
    await vi.waitFor(
      () =>
        expect(errorSpy).toHaveBeenCalledWith(
          '[uc][cloud-image-editor]',
          '[cloud-image-editor] timeout waiting for non-zero container size',
        ),
      { timeout: 5000 },
    );
  });

  it('activates the cropper on the crop tab', async () => {
    const { editor } = renderEditor();
    const cropper = editor.getByTestId('uc-editor-image-cropper');

    await expect.element(cropper).toBeVisible();
    await expect.poll(() => activeClass(cropper.element())).toMatch(/uc-active_from_/);
  });

  it('keeps the classes on the cropper while it activates and deactivates', async () => {
    const { element, editor } = renderEditor();
    const cropper = editor.getByTestId('uc-editor-image-cropper');
    const fader = () => activeClass(element.querySelector('uc-editor-image-fader'));
    await expect.poll(() => activeClass(cropper.element())).toMatch(/uc-active_from_/);
    cropper.element().classList.add('my-cropper');

    await userEvent.click(editor.getByRole('tab', { name: /tuning/i }));
    await expect.poll(fader, { timeout: 5000 }).toMatch(/uc-active_from_/);
    expect(activeClass(cropper.element())).toMatch(/\bmy-cropper\b/);

    await userEvent.click(editor.getByRole('tab', { name: /crop/i }));
    await expect.poll(() => activeClass(cropper.element())).toMatch(/uc-active_from_/);
    expect(activeClass(cropper.element())).toMatch(/\bmy-cropper\b/);
  });

  it('keeps the classes on the fader while it activates and deactivates', async () => {
    const { element, editor } = renderEditor();
    const cropper = editor.getByTestId('uc-editor-image-cropper');
    const faderEl = () => element.querySelector('uc-editor-image-fader');
    const fader = () => activeClass(faderEl());
    await expect.poll(() => activeClass(cropper.element())).toMatch(/uc-active_from_/);
    faderEl()?.classList.add('my-fader');

    await userEvent.click(editor.getByRole('tab', { name: /tuning/i }));
    await expect.poll(fader, { timeout: 5000 }).toMatch(/uc-active_from_/);
    expect(fader()).toMatch(/\bmy-fader\b/);

    await userEvent.click(editor.getByRole('tab', { name: /crop/i }));
    await expect.poll(fader).toMatch(/uc-inactive_to_cropper/);
    expect(fader()).toMatch(/\bmy-fader\b/);
  });

  it('places the slider thumb, zero dot and step ticks from the value and the width', async () => {
    const { element, editor } = renderEditor();
    await userEvent.click(editor.getByRole('tab', { name: /tuning/i }));
    await userEvent.click(editor.getByRole('option', { name: /Brightness/i }));
    await expect.element(editor.getByTestId('uc-editor-slider')).toBeVisible();
    const slider = element.querySelector('uc-slider-ui') as SliderUi;
    const input = slider.querySelector('input') as HTMLInputElement;

    const layout = () => {
      const host = slider.getBoundingClientRect();
      const thumb = slider.querySelector('.uc-thumb')?.getBoundingClientRect();
      const dot = slider.querySelector('.uc-zero-dot');
      const dotBox = dot?.getBoundingClientRect();
      const track = host.width - (thumb?.width ?? 0);
      const at = (value: number) => (track * (value - slider.min)) / (slider.max - slider.min);
      const stepsWidth = slider.querySelector('.uc-steps')?.getBoundingClientRect().width ?? 0;
      return {
        // Whole pixels, and `abs` so a hair to the left (-0) still equals 0.
        thumbOffBy: Math.abs(Math.round((thumb?.left ?? 0) - host.left - at(Number(input.value)))),
        dotOffBy: Math.abs(
          Math.round(
            (dotBox?.left ?? 0) - host.left - ((thumb?.width ?? 0) / 2 - (dotBox?.width ?? 0) / 2 + at(slider.zero)),
          ),
        ),
        dotOpacity: dot ? getComputedStyle(dot).opacity : null,
        minorSteps: slider.querySelectorAll('.uc-minor-step').length,
        expectedMinorSteps: 2 * (Math.ceil(Math.ceil(stepsWidth / 2) / 15) - 2),
        borderSteps: slider.querySelectorAll('.uc-border-step').length,
      };
    };
    const settled = (dotOpacity: string) => ({
      thumbOffBy: 0,
      dotOffBy: 0,
      dotOpacity,
      minorSteps: layout().expectedMinorSteps,
      expectedMinorSteps: layout().expectedMinorSteps,
      borderSteps: 3,
    });

    expect(input.value).toBe(String(slider.zero));
    await expect.poll(layout).toEqual(settled('0'));

    input.value = String(slider.max - 10);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await expect.poll(layout).toEqual(settled('1'));

    slider.style.width = '200px';
    await expect.poll(() => slider.getBoundingClientRect().width).toBe(200);
    await expect.poll(layout).toEqual(settled('1'));
  });

  it('keeps the tab indicator under the active tab, also when a new image arrives', async () => {
    const { element, editor } = renderEditor();
    const cropper = editor.getByTestId('uc-editor-image-cropper');
    const indicatorOffBy = (tabId: string) => {
      const tab = element.querySelector(`uc-btn-ui[data-id="${tabId}"]`)?.getBoundingClientRect();
      const indicator = element.querySelector('.uc-tab-toggles_indicator')?.getBoundingClientRect();
      if (!tab?.width || !indicator) return null;
      return {
        left: Math.abs(Math.round(indicator.left - tab.left)),
        width: Math.abs(Math.round(indicator.width - tab.width)),
      };
    };
    await expect.poll(() => activeClass(cropper.element())).toMatch(/uc-active_from_/);
    await expect.poll(() => indicatorOffBy('crop')).toEqual({ left: 0, width: 0 });

    await userEvent.click(editor.getByRole('tab', { name: /tuning/i }));
    await expect.poll(() => indicatorOffBy('tuning')).toEqual({ left: 0, width: 0 });

    element.setAttribute('uuid', DEMO_IMAGE_UUID);
    await expect
      .poll(() => activeClass(element.querySelector('uc-editor-image-fader')), { timeout: 5000 })
      .toMatch(/uc-active_from_/);
    await expect.poll(() => indicatorOffBy('tuning')).toEqual({ left: 0, width: 0 });
  });

  it('renders its icons', async () => {
    const { element } = renderEditor();

    await expect
      .poll(
        () =>
          [...element.querySelectorAll('uc-editor-icon')].filter((icon) => {
            const use = icon.querySelector('svg use');
            return (use?.getAttribute('href') ?? use?.getAttribute('xlink:href'))?.startsWith('#uc-icon-');
          }).length,
      )
      .toBeGreaterThan(0);
  });

  it('applies a rotation clicked twice as 180 degrees', async () => {
    const { element, editor } = renderEditor();
    const cropper = editor.getByTestId('uc-editor-image-cropper');
    await expect.poll(() => activeClass(cropper.element())).toMatch(/uc-active_from_/);
    let applied: ApplyResult | null = null;
    element.addEventListener('apply', (event) => {
      applied = (event as CustomEvent<ApplyResult>).detail;
    });

    // Rotate is the first crop button.
    const rotate = editor.getByTestId('uc-editor-crop-button-control').nth(0);
    await userEvent.click(rotate);
    await userEvent.click(rotate);
    await expect.poll(() => activeClass(cropper.element())).toMatch(/uc-active_from_/);
    await userEvent.click(editor.getByRole('button', { name: /apply/i }));

    await expect.poll(() => applied?.transformations.rotate).toBe(180);
  });

  it('activates the color preview on the tuning tab and keeps it live while a slider moves', async () => {
    const { element, editor } = renderEditor();
    // The fader renders before testMode reaches it, so it has no test id.
    const fader = () => activeClass(element.querySelector('uc-editor-image-fader'));

    await userEvent.click(editor.getByRole('tab', { name: /tuning/i }));
    await expect.poll(fader, { timeout: 5000 }).toMatch(/uc-active_from_/);

    await userEvent.click(editor.getByRole('option', { name: /Brightness/i }));
    const slider = editor.getByTestId('uc-editor-slider');
    await expect.element(slider).toBeVisible();
    await userEvent.click(slider);
    await userEvent.keyboard('[ArrowRight]');

    await expect.poll(fader, { timeout: 5000 }).toMatch(/uc-active_from_/);
  });

  it('shows an operation it cannot edit in the viewer and in the filter thumbnails', async () => {
    const { element, editor } = renderEditor({ 'cdn-url': `https://ucarecdn.com/${UUID}/-/blur/20/` });
    await expect.element(element).toBeVisible();

    await userEvent.click(editor.getByRole('tab', { name: /filters/i }));
    await expect
      .poll(() => activeClass(element.querySelector('uc-editor-image-fader')), { timeout: 5000 })
      .toMatch(/uc-active_from_/);

    const viewerSrc = () => element.querySelector('uc-editor-image-fader img')?.getAttribute('src') ?? '';
    await expect.poll(viewerSrc, { timeout: 5000 }).toContain('blur/20');

    // The first filter control is "Original", which has no preview.
    const thumbnail = editor.getByTestId('uc-editor-filter-control').nth(1);
    await expect.element(thumbnail).toBeVisible();
    const thumbnailStyle = () => thumbnail.element().querySelector('.uc-preview')?.getAttribute('style') ?? '';
    await expect.poll(thumbnailStyle, { timeout: 5000 }).toContain('blur/20');
  });
});

describe('editor elements created with document.createElement', () => {
  it.each([
    ['uc-slider-ui', SliderUi],
    ['uc-editor-image-fader', EditorImageFader],
  ] as const)('%s is an instance of its class', (tag, Class) => {
    expect(document.createElement(tag)).toBeInstanceOf(Class);
  });
});

describe('uc-cloud-image-editor without <uc-config>', () => {
  /** Config comes from the editor's own attributes and the locale from its bundled English default. */
  const renderStandalone = (cdnUrl?: string) => {
    page.render(
      cdnUrl ? (
        <uc-cloud-image-editor cdn-url={cdnUrl} cdn-cname="https://ucarecdn.com/" test-mode></uc-cloud-image-editor>
      ) : (
        <uc-cloud-image-editor uuid={UUID} cdn-cname="https://ucarecdn.com/" test-mode></uc-cloud-image-editor>
      ),
    );
    const element = document.querySelector<HTMLElement>('uc-cloud-image-editor')!;
    return { element, editor: within(element) };
  };

  const PARSE_WARNING = [
    '[uc][cloud-image-editor]',
    'Failed to parse CDN URL, opening editor without transformations',
    expect.any(Error),
  ];

  it('renders, activates the cropper, shows its icons and speaks English', async () => {
    const { element, editor } = renderStandalone();

    await expect.element(element).toBeVisible();
    await expect.poll(() => activeClass(element.querySelector('uc-editor-image-cropper'))).toMatch(/uc-active_from_/);
    await expect
      .poll(() => [...element.querySelectorAll('uc-editor-icon')].some((icon) => icon.querySelector('svg use')))
      .toBe(true);

    await userEvent.click(editor.getByRole('tab', { name: /tuning/i }));
    await expect.element(editor.getByRole('option', { name: /Brightness/i })).toBeVisible();
  });

  it('warns and opens a usable editor without transformations for a group cdn-url', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { element, editor } = renderStandalone(GROUP_CDN_URL);

      await expect.element(element).toBeVisible();
      await vi.waitFor(() => expect(warnSpy).toHaveBeenCalledWith(...PARSE_WARNING));
      // A usable editor, not just its shell: the toolbar only renders once initialization finished.
      await expect.element(editor.getByTestId('uc-editor-toolbar')).toBeVisible();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('leaves the open image alone when cdn-url changes to one it cannot parse', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { element } = renderStandalone(`https://ucarecdn.com/${UUID}/`);
      const cropper = () => activeClass(element.querySelector('uc-editor-image-cropper'));
      await expect.poll(cropper).toMatch(/uc-active_from_/);
      // Installed only now, so it sees just what follows the bad cdn-url: refetching image info would be a request.
      const fetchSpy = vi.spyOn(window, 'fetch');

      element.setAttribute('cdn-url', GROUP_CDN_URL);
      await vi.waitFor(() => expect(warnSpy).toHaveBeenCalledWith(...PARSE_WARNING));

      // Negative wait: a fall-through would refetch on the next tick; nothing marks that it did not.
      await delay(50);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(cropper()).toMatch(/uc-active_from_/);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('keeps firing change after it is moved to another parent', async () => {
    const { element, editor } = renderStandalone();
    const cropper = () => activeClass(element.querySelector('uc-editor-image-cropper'));
    await expect.poll(cropper).toMatch(/uc-active_from_/);
    const changes: ApplyResult[] = [];
    element.addEventListener('change', (event) => {
      changes.push((event as CustomEvent<ApplyResult>).detail);
    });

    const other = document.createElement('div');
    element.after(other);
    other.append(element);
    await expect.poll(cropper).toMatch(/uc-active_from_/);
    await userEvent.click(editor.getByTestId('uc-editor-crop-button-control').nth(0));

    await expect.poll(() => changes.at(-1)?.transformations.rotate).toBe(90);
  });

  it('becomes visible when moved out of a zero-sized parent while it waits for a size', async () => {
    page.render(
      <div style="width: 0; height: 0; overflow: hidden;">
        <uc-cloud-image-editor uuid={UUID} cdn-cname="https://ucarecdn.com/" test-mode></uc-cloud-image-editor>
      </div>,
    );
    const element = document.querySelector<HTMLElement>('uc-cloud-image-editor')!;
    await delay(50);
    expect(element.classList.contains('uc-editor_ON')).toBe(false);

    const sized = document.createElement('div');
    document.body.append(sized);
    try {
      sized.append(element);
      await expect.poll(() => element.classList.contains('uc-editor_ON')).toBe(true);
    } finally {
      sized.remove();
    }
  });
});
