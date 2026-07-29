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

  it('renders editor icons (uc-editor-icon, plain-Lit and ctx-free)', async () => {
    // Regression guard (M12 flip / editor-isolation Task 1): editor icons are
    // `uc-editor-icon` — a plain-Lit, ctx-free element (no ChildBlock, no
    // uploader ctx adoption needed) that renders its sprite `<use>` directly
    // off its `name` property. Previously this guarded `uc-icon` (a
    // ChildBlock) needing the light editor root to re-provide ctx-name down
    // its tree; that coupling no longer exists for icons, but we keep the
    // guard so a broken sprite/name binding still fails a suite that
    // otherwise only checks the shell mounts.
    await expect
      .poll(
        () =>
          [...document.querySelectorAll('uc-editor-icon')].filter((ic) => {
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

  it('applies a crop operation through state (rotate) without recursion', async () => {
    // Regression guard (editor-isolation Task 5): crop ops are modelled through
    // `*editorTransformations` — `EditorCropButtonControl` writes it and the
    // cropper reacts + re-commits, instead of the button calling
    // `cropper.setValue` via a `*cropperEl` state ref. The commit re-notifies
    // synchronously, so the cropper's reaction has a re-entrancy guard; without
    // it a deactivate→commit→notify cycle recursed to a RangeError.
    const cropper = page.getByTestId('uc-editor-image-cropper');
    await expect.element(cropper).toBeVisible();
    await expect.poll(() => cropper.element().className).toMatch(/uc-active_from_/);

    // Capture the applied transformations (the toolbar's `done` button emits
    // `uc-internal:apply` with the current `*editorTransformations`) so we
    // assert the clicks actually took effect, not just that the cropper stayed
    // alive. `rotate` is the first crop button (ALL_CROP_OPERATIONS order).
    let applied: { rotate?: number } | null = null;
    const onApply = (event: Event) => {
      applied = (event as CustomEvent<{ rotate?: number }>).detail;
    };
    document.addEventListener('uc-internal:apply', onApply);
    try {
      const cropButtons = page.getByTestId('uc-editor-crop-button-control');
      await userEvent.click(cropButtons.nth(0));
      await userEvent.click(cropButtons.nth(0));

      // Cropper survived the repeated state-driven ops (recursion guard).
      await expect.poll(() => cropper.element().className).toMatch(/uc-active_from_/);

      await userEvent.click(page.getByRole('button', { name: /apply/i }));
      await expect.poll(() => applied?.rotate).toBe(180);
    } finally {
      document.removeEventListener('uc-internal:apply', onApply);
    }
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

  it('fader self-activates on a color tab and previews via *colorPreview (no *faderEl)', async () => {
    // Regression guard (editor-isolation Task 6): the fader self-activates from
    // `*tabId`/`*originalUrl` + its `imageSize` prop, and the slider drives its
    // live preview through `*colorPreview` — no `*faderEl` ref. Its reaction has
    // the same re-entrancy guard as the cropper (deactivate commits + notifies
    // synchronously), so entering the tab + previewing must not crash/recurse.
    await userEvent.click(page.getByRole('tab', { name: /tuning/i }));

    // Self-activation: entering a non-crop tab activates the fader (its layers
    // are absolutely positioned, so assert the active class like the cropper
    // test does, not `toBeVisible`). The fader has no `data-testid` (it renders
    // before `testMode` config propagates), so locate it by tag. Activation
    // resolves a proxied CDN URL then loads the image → allow a generous window.
    const faderClass = () => document.querySelector('uc-editor-image-fader')?.className ?? '';
    await expect.poll(faderClass, { timeout: 5000 }).toMatch(/uc-active_from_/);

    // Slider preview flows through `*colorPreview` → the fader reacts.
    await userEvent.click(page.getByRole('option', { name: /Brightness/i }));
    const slider = page.getByTestId('uc-editor-slider');
    await expect.element(slider).toBeVisible();
    await userEvent.click(slider);
    await userEvent.keyboard('[ArrowRight]');

    // Preview stayed live (no recursion/teardown).
    await expect.poll(faderClass, { timeout: 5000 }).toMatch(/uc-active_from_/);
  });

  it('renders a preserved operation in the viewer and a filter thumbnail', async () => {
    // Regression guard (render-preserved-operations Task 3): the crop is now
    // emitted after everything the source carries but the editor can't model
    // (`preservedOperations`), and previews render those operations too — so
    // the user sees the same image the crop will land on. A crop-drag
    // assertion would be flaky (documented render race under full parallel
    // load), so pin the observable mechanism instead: a preserved `blur/20`
    // (no uuid needed, unlike `overlay`) must show up in both the viewer and
    // a filter thumbnail's requested src.
    cleanup();

    const ctxName = `test-${Math.random().toString(36).slice(2)}`;
    page.render(
      <>
        <uc-cloud-image-editor
          crop-preset="1:1, 16:9, 4:3, 3:4, 9:16"
          cdn-url="https://ucarecdn.com/f4dc9ebc-ed6d-4b4d-83d1-863bf1e4bb7f/-/blur/20/"
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

    await expect.element(page.getByTestId('uc-cloud-image-editor')).toBeVisible();

    // Enter a non-crop tab to activate the viewer (fader). Same tag-based
    // lookup as the test above — the fader has no `data-testid` (it renders
    // before `testMode` config propagates).
    await userEvent.click(page.getByRole('tab', { name: /filters/i }));
    const faderClass = () => document.querySelector('uc-editor-image-fader')?.className ?? '';
    await expect.poll(faderClass, { timeout: 5000 }).toMatch(/uc-active_from_/);

    const viewerImage = () => document.querySelector('uc-editor-image-fader img')?.getAttribute('src') ?? '';
    await expect.poll(viewerImage, { timeout: 5000 }).toContain('blur/20');

    // `filterIds[0]` is the "Original" pseudo-filter (no preview computed for
    // it), so the first real filter thumbnail is index 1.
    const thumbnail = page.getByTestId('uc-editor-filter-control').nth(1);
    await expect.element(thumbnail).toBeVisible();
    const thumbnailPreviewStyle = () => thumbnail.element().querySelector('.uc-preview')?.getAttribute('style') ?? '';
    await expect.poll(thumbnailPreviewStyle, { timeout: 5000 }).toContain('blur/20');
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
      expect(errorSpy).toHaveBeenCalledWith(
        '[uc][cloud-image-editor]',
        '[cloud-image-editor] timeout waiting for non-zero container size',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
