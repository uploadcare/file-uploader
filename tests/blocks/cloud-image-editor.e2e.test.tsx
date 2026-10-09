import { DEMO_IMAGE_UUID, EDITOR_IMAGE_UUID } from '@uploadcare/api-emulator';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '~/types/jsx';
import { withResolvers } from '@/utils/withResolvers';
import type { TelemetryBody } from '~/tests/api/telemetry/sink';
import { emulatorSession, isLive } from '~/tests/utils/emulator.browser';
import { inCtx, within } from '~/tests/utils/render-solution';
import { getCtxName } from '~/tests/utils/test-renderer';

/** What the editor reports when it cannot load the image's info. */
const IMAGE_INFO_ERROR = 'Error in cloud editor image. Failed to load image info';

/** `<uc-cloud-image-editor>` is not part of any solution, so it is rendered by hand with its own config. */
const renderEditor = ({ uuid = EDITOR_IMAGE_UUID, qualityInsights = false } = {}) => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-cloud-image-editor
        crop-preset="1:1, 16:9, 4:3, 3:4, 9:16"
        uuid={uuid}
        ctx-name={ctxName}
      ></uc-cloud-image-editor>
      <uc-config
        cdn-cname="https://ucarecdn.com/"
        quality-insights={String(qualityInsights)}
        ctx-name={ctxName}
        pubkey="demopublickey"
        testMode
      ></uc-config>
    </>,
  );
  const element = inCtx<HTMLElement>('uc-cloud-image-editor', ctxName);
  return { element, editor: within(element) };
};

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
    const freeform = editor.getByTestId('uc-editor-freeform-button-control');

    await userEvent.click(freeform);

    const preset16x9 = editor.getByTestId('uc-editor-aspect-ratio-button-control').nth(1);
    await expect.element(preset16x9).toBeVisible();
    await userEvent.click(preset16x9);

    await userEvent.click(editor.getByRole('button', { name: /apply/i }));

    await expect.element(freeform).toBeVisible();
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
    const removed = renderEditor({ qualityInsights: true });
    // Gets the same failed answer while still on the page, so it does report, and that report is the sign the
    // removed editor's answer has landed too.
    renderEditor({ uuid: DEMO_IMAGE_UUID, qualityInsights: true });
    await expect.poll(() => [...held].sort()).toEqual([DEMO_IMAGE_UUID, EDITOR_IMAGE_UUID].sort());

    removed.element.parentElement?.remove();
    released.resolve();

    const imageInfoLogs = () => errorSpy.mock.calls.filter(([message]) => message === 'Failed to load image info');
    const imageInfoErrors = () =>
      (emulatorSession().telemetry as TelemetryBody[]).filter(
        (body) => body.payload.metadata?.text === IMAGE_INFO_ERROR,
      );
    await expect.poll(() => imageInfoErrors().length).toBe(1);
    expect(imageInfoLogs()).toHaveLength(1);
    expect(rejections).toEqual([]);
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
    expect(errorSpy).toHaveBeenCalledWith('[cloud-image-editor] timeout waiting for non-zero container size');
  });
});
