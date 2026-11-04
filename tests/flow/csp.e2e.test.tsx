import { EDITOR_IMAGE_UUID } from '@uploadcare/api-emulator';
import { beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { CameraPreview } from '@/blocks/CameraSource/CameraPreview';
import { createInCtx, inCtx, renderSolution, waitForBlocks, within } from '~/tests/utils/render-solution';
import { getCtxName } from '~/tests/utils/test-renderer';
import '~/types/jsx';

/**
 * The Content-Security-Policy that security.mdx recommends: no `'unsafe-inline'`, so the browser drops every inline
 * `style` attribute while styles set through CSSOM (`el.style.x = …`) still apply. A meta CSP inserted at runtime is
 * enforced from that point on, and the page's stylesheets were all inserted before it, during setup.
 */
beforeAll(() => {
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = "style-src 'self' blob:";
  document.head.append(meta);
});

describe('under the documented CSP', () => {
  it('sizes the upload list spacers, so every file can be scrolled to', async () => {
    // The modal bounds the list's height, so `.uc-files` scrolls and the list virtualizes.
    const { api, root } = await renderSolution('regular', { confirmUpload: true, multipleMax: 1000 });
    for (let i = 0; i < 300; i++) {
      api.addFileFromObject(new File(['x'], `f${i}.txt`, { type: 'text/plain' }));
    }
    api.setCurrentActivity('upload-list');
    api.setModalState(true);
    await expect.element(within(root).getByTestId('uc-upload-list')).toBeVisible();

    await expect.poll(() => root.querySelector('.uc-list-spacer')).not.toBeNull();
    const spacer = root.querySelector<HTMLElement>('.uc-list-spacer')!;
    expect(spacer.style.height).not.toBe('');
    // Spacer heights come from measured rows and can be fractional, which layout rounds to 1/64 px.
    expect(spacer.getBoundingClientRect().height).toBeCloseTo(Number.parseFloat(spacer.style.height), 0);

    const files = root.querySelector<HTMLElement>('.uc-files')!;
    files.scrollTop = files.scrollHeight;
    await expect.poll(() => root.querySelector('uc-file-item:last-of-type')?.textContent).toContain('f299.txt');
  });

  it('places the editor slider thumb and zero dot at their values', async () => {
    // Set before connecting, so the values land in the first render: the one `styleMap` writes as an attribute.
    const slider = document.createElement('uc-slider-ui');
    slider.min = -100;
    slider.max = 100;
    slider.zero = 0;
    slider.defaultValue = 50;
    page.render(slider);
    await slider.updateComplete;

    expect(slider.querySelector<HTMLElement>('.uc-thumb')!.style.getPropertyValue('--l-fraction')).toBe('0.75');
    const zeroDot = slider.querySelector<HTMLElement>('.uc-zero-dot')!;
    expect(zeroDot.style.getPropertyValue('--l-fraction')).toBe('0.5');
    expect(zeroDot.style.opacity).toBe('1');
  });

  it("sets the file item's progress ring offset", async () => {
    // Not uploading, so the offset keeps its first-render value and no later CSSOM update hides a dropped attribute.
    const { api, root } = await renderSolution('regular', { confirmUpload: true });
    api.addFileFromObject(new File(['x'], 'a.txt', { type: 'text/plain' }));
    api.setCurrentActivity('upload-list');
    api.setModalState(true);

    await expect.poll(() => root.querySelector('uc-file-action-button .uc-preloader')).not.toBeNull();
    const preloader = root.querySelector<HTMLElement>('uc-file-action-button .uc-preloader')!;
    expect(preloader.style.getPropertyValue('--l-progress-offset')).toBe('100');
  });

  it('mirrors the camera preview', async () => {
    const { ctxName, root } = await renderSolution('regular');
    // Set before connecting, so the mirror lands in the first render. Mounted bare: opening the camera isn't needed.
    const preview = createInCtx<CameraPreview>('uc-camera-preview', ctxName);
    preview.mirror = true;
    root.after(preview);
    await waitForBlocks(preview);

    expect(preview.querySelector('video')!.style.transform).toBe('scaleX(-1)');
  });

  it("places the editor's tab toggles and filter thumbnails", async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-cloud-image-editor uuid={EDITOR_IMAGE_UUID} ctx-name={ctxName}></uc-cloud-image-editor>
        <uc-config cdn-cname="https://ucarecdn.com/" ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </>,
    );
    const editorEl = inCtx<HTMLElement>('uc-cloud-image-editor', ctxName);
    const editor = within(editorEl);
    const tab = editor.getByRole('tab', { name: /filters/i });
    await expect.element(tab).toBeVisible();

    // A consistency check only: the toolbar renders again once the editor loads, and styleMap's second render went
    // through CSSOM too, so this passed before the fix. The filter opacities below are the part that fails without it.
    const toggles = [...editorEl.querySelectorAll<HTMLElement>('.uc-tab-toggle uc-btn-ui')];
    expect(toggles.map((toggle) => `${toggle.dataset.id}:${toggle.style.gridColumn}`)).toEqual([
      'crop:1',
      'tuning:2',
      'filters:3',
    ]);

    await userEvent.click(tab);
    const original = editor.getByRole('option', { name: 'Apply original filter', exact: true });
    await expect.element(original).toBeVisible();
    const control = original.element() as HTMLElement;
    expect(control.querySelector<HTMLElement>('.uc-preview')!.style.opacity).toBe('0');
    expect(control.querySelector<HTMLElement>('uc-editor-icon')!.style.opacity).toBe('1');
  });

  // Last in the file: the policy it adds narrows the file's one to exactly the documented `style-src 'self'`, and
  // stays enforced for every test after it.
  it("renders every file of a page-scrolled inline list under style-src 'self'", async () => {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = "style-src 'self'";
    document.head.append(meta);

    // Nothing bounds the inline uploader's height, so the page scrolls rather than `.uc-files`.
    const { api, root } = await renderSolution('inline', { confirmUpload: true, multipleMax: 1000 });
    for (let i = 0; i < 300; i++) {
      api.addFileFromObject(new File(['x'], `f${i}.txt`, { type: 'text/plain' }));
    }
    api.setCurrentActivity('upload-list');
    await expect.element(within(root).getByTestId('uc-upload-list')).toBeVisible();

    // A file item renders its name once it scrolls into view, and rows grow as their thumbnails load: scroll again
    // on every poll until the page bottom holds the last file.
    const scroller = document.scrollingElement!;
    const lastName = () => {
      scroller.scrollTop = scroller.scrollHeight;
      return root.querySelector('uc-file-item:last-of-type')?.textContent;
    };
    await expect.poll(lastName).toContain('f299.txt');
    const last = root.querySelector<HTMLElement>('uc-file-item:last-of-type')!;
    expect(last.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
  });
});
