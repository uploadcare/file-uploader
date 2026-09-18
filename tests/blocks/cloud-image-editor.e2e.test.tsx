import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '~/types/jsx';
import { inCtx, within } from '~/tests/utils/render-solution';
import { getCtxName } from '~/tests/utils/test-renderer';

/** `<uc-cloud-image-editor>` is not part of any solution, so it is rendered by hand with its own config. */
const renderEditor = () => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-cloud-image-editor
        crop-preset="1:1, 16:9, 4:3, 3:4, 9:16"
        uuid="f4dc9ebc-ed6d-4b4d-83d1-863bf1e4bb7f"
        ctx-name={ctxName}
      ></uc-cloud-image-editor>
      <uc-config
        cdn-cname="https://ucarecdn.com/"
        quality-insights="false"
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

  it('logs a timeout without an unhandled rejection when the container size stays zero', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const ctxName = getCtxName();
      page.render(
        <>
          <div style="width: 0; height: 0; overflow: hidden;">
            <uc-cloud-image-editor
              crop-preset="1:1, 16:9, 4:3, 3:4, 9:16"
              uuid="f4dc9ebc-ed6d-4b4d-83d1-863bf1e4bb7f"
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
    } finally {
      errorSpy.mockRestore();
    }
  });
});
