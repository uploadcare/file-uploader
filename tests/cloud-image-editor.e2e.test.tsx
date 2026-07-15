import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { delay } from '@/utils/delay';
import '../types/jsx';
import { cleanup } from './utils/test-renderer';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

beforeEach(() => {
  const ctxName = `test-${Math.random().toString(36).slice(2)}`;
  page.render(
    <>
      <uc-cloud-image-editor
        crop-preset="1:1, 16:9, 4:3, 3:4, 9:16"
        uuid="f4dc9ebc-ed6d-4b4d-83d1-863bf1e4bb7f"
        ctx-name={ctxName}
      ></uc-cloud-image-editor>
      <uc-config
        cdn-cname="https://ucarecdn.com/"
        qualityInsights={false}
        ctx-name={ctxName}
        pubkey="demopublickey"
        testMode
      ></uc-config>
    </>,
  );
});

describe('Cloud Image Editor', () => {
  it('should be rendered', async () => {
    await expect.element(page.getByTestId('uc-cloud-image-editor')).toBeVisible();
  });

  it('activates the cropper on the crop tab (renders the image + crop frame)', async () => {
    // Regression guard (M12 editor port): "should be rendered" only proves the
    // shell mounts — it does NOT prove the cropper draws the image. The cropper
    // is rendered behind an `_isInitialized` gate, so the root captures its ref
    // and calls `activate()` only *after* that subtree renders. When that
    // post-init ref capture regressed, the cropper element existed but stayed
    // blank (no `<img>`/canvas draw, no crop frame) — every other test here
    // still passed. `activate()` is what marks the element `uc-active_from_*`
    // and draws the CDN image onto its canvas, so assert we actually get there.
    const cropper = page.getByTestId('uc-editor-image-cropper');
    await expect.element(cropper).toBeVisible();
    await expect.poll(() => cropper.element().className).toMatch(/uc-active_from_/);
  });

  it('renders editor icons (nested uc-icon ChildBlocks adopt the editor ctx)', async () => {
    // Regression guard (M12 flip): editor icons are `uc-icon` — a ChildBlock
    // that must adopt the shared uploader ctx to render its sprite `<use>`.
    // That only happens if the light editor root *re-provides* the ctx-name
    // `@lit/context` down its tree (ChildBlock does this for its own
    // descendants; the light base doesn't). When it didn't, every toolbar/tab
    // icon rendered empty while the rest of the editor looked fine — invisible
    // to a suite that only checks the shell mounts.
    await expect
      .poll(
        () =>
          [...document.querySelectorAll('uc-icon')].filter((ic) => {
            const use = ic.querySelector('svg use');
            return (use?.getAttribute('href') ?? use?.getAttribute('xlink:href'))?.startsWith('#uc-icon-');
          }).length,
      )
      .toBeGreaterThan(0);
  });

  it('should select tunings tab', async () => {
    const flip = page.getByTestId('uc-editor-crop-button-control').nth(2);

    await userEvent.click(flip);
  });

  it('should select crop preset', async () => {
    const freeform = page.getByTestId('uc-editor-freeform-button-control');

    await userEvent.click(freeform);

    const preset16x9 = page.getByTestId('uc-editor-aspect-ratio-button-control').nth(1);

    await expect.element(preset16x9).toBeVisible();

    await userEvent.click(preset16x9);

    const apply = page.getByRole('button', { name: /apply/i });

    await userEvent.click(apply);

    await expect.element(freeform).toBeVisible();
  });

  it("should apply 'brightness' operation", async () => {
    const tuningTab = page.getByRole('tab', { name: /tuning/i });
    await userEvent.click(tuningTab);

    const brightness = page.getByRole('option', { name: /Brightness/i });
    await userEvent.click(brightness);

    const slider = page.getByTestId('uc-editor-slider');
    await expect.element(slider).toBeVisible();

    const applySlider = page.getByRole('button', { name: /apply/i });
    await userEvent.click(slider);
    await userEvent.keyboard('[ArrowRight]');
    await userEvent.click(applySlider);

    await expect.element(tuningTab).toBeVisible();
  });

  it('should log timeout without unhandled rejection when container size stays zero', async () => {
    cleanup();

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const ctxName = `test-${Math.random().toString(36).slice(2)}`;

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
            qualityInsights={false}
            ctx-name={ctxName}
            pubkey="demopublickey"
            testMode
          ></uc-config>
        </>,
      );

      await delay(3100);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith('[cloud-image-editor] timeout waiting for non-zero container size');
    } finally {
      errorSpy.mockRestore();
    }
  });
});
