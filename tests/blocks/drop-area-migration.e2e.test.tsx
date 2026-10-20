import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { SecureUploadsController } from '@/abstract/controllers/SecureUploadsController';
import { UploadCollectionController } from '@/abstract/controllers/UploadCollectionController';
import { UploadController } from '@/abstract/controllers/UploadController';
import { UploadEventsController } from '@/abstract/controllers/UploadEventsController';
import { ValidationController } from '@/abstract/controllers/ValidationController';
import type { ControllerContainer } from '@/abstract/di/ControllerContainer';
import { UploaderPublicApi } from '@/abstract/UploaderPublicApi';
import type { Config, DropArea, UploadCtxProvider } from '@/index.ts';
import { TEST_IMAGE_URL } from '../utils/constants';
import { containerOf, hasCtx } from '../utils/registry';
import { getCtxName } from '../utils/test-renderer';
import '../../types/jsx';

// M10 Task 1 — coverage-first safety net ahead of the `LitUploaderBlock` ->
// `ChildBlock` port of `<uc-drop-area>` (src/blocks/DropArea/DropArea.ts).
// `<uc-drop-area>` has no dedicated e2e suite today (only indirect coverage
// via the solution + start-from suites), and it is uniquely load-bearing:
// via `LitUploaderBlock.initCallback` it is the SOLE element that attaches
// the uploader scope in the built-in solutions (they render `<uc-drop-area>`
// directly and never include a `<uc-upload-ctx-provider>`). These pins must
// hold on the current v1 code and must keep holding after the port.

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

describe('uc-drop-area — uploader-scope-attach (solution-only composition, no provider)', () => {
  it('attaches the full uploader scope from a bare solution + config composition (no <uc-upload-ctx-provider>)', async () => {
    const ctxName = getCtxName();

    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </>,
    );

    // Sanity: this composition genuinely has no provider — DropArea (inside
    // start-from) must be the thing attaching the scope.
    expect(document.querySelector('uc-upload-ctx-provider')).toBeNull();

    await expect.poll(() => hasCtx(ctxName)).toBe(true);
    const container = containerOf(ctxName);

    await expect.poll(() => container.has(UploaderPublicApi)).toBe(true);
    expect(container.has(UploadController)).toBe(true);
    expect(container.has(ValidationController)).toBe(true);
    expect(container.has(SecureUploadsController)).toBe(true);
    expect(container.has(UploadEventsController)).toBe(true);
    expect(container.has(UploadCollectionController)).toBe(true);

    // Provider-less API works: grab a drop-area and resolve its own container
    // surface directly, exactly as the solution does internally.
    const dropArea = page.getByTestId('uc-drop-area').first().query()! as DropArea;
    expect(dropArea).toBeTruthy();
    const dropAreaContainer = (dropArea as unknown as { container: ControllerContainer }).container;
    expect(typeof dropAreaContainer.get(UploaderPublicApi).openSystemDialog).toBe('function');
    expect(dropAreaContainer.get(UploadController)).toBeTruthy();
  });
});

describe('uc-drop-area — drag & drop', () => {
  const renderRegularWithProvider = () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );
    const provider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    return { ctxName, api: provider.getAPI() };
  };

  it('dropping a url onto the modal drop-area grows the collection and advances the router (onFileAdd)', async () => {
    const { api } = renderRegularWithProvider();

    await page.getByText('Upload files', { exact: true }).click();
    await expect.element(page.getByTestId('uc-start-from')).toBeVisible();
    await expect.poll(() => document.querySelector('uc-start-from')?.hasAttribute('active')).toBe(true);
    expect(api.getOutputCollectionState().allEntries.length).toBe(0);

    // A real cross-element `userEvent.dragAndDrop` (as used by
    // tests/file-uploader-minimal.e2e.test.tsx "should drag and drop file",
    // which drags an anchor tag — real anchor drags natively populate
    // `text/uri-list` — onto the WHOLE solution root) is coordinate/hit-test
    // dependent and flaky once the drop-area is nested inside a `<uc-modal>`
    // dialog (Playwright repeatedly reported the target as "not
    // visible"/"not stable" mid-gesture here). Dispatching the `drop`
    // `DragEvent` directly on the drop-area element sidesteps that
    // instability while still exercising the exact production code path:
    // `getDropItems` (src/blocks/DropArea/getDropItems.ts) branches on
    // `item.kind === 'string' && /^text\/uri-list/.test(item.type)` with no
    // filesystem-entry involvement, so a plain `DataTransfer` built via
    // `setData('text/uri-list', ...)` is indistinguishable from a real
    // browser-native link/URL drag for this branch — unlike a `kind:
    // 'file'` item, which `getDropItems` skips whenever
    // `item.webkitGetAsEntry()` exists but returns null (true for
    // programmatically-constructed file items, since they lack a real OS
    // filesystem entry). So the *file* path is pinned via
    // `userEvent.dragAndDrop` in the same-idiom minimal suite; here we pin
    // the *url* path, deterministically, through DropArea's real listener.
    const dropArea = document.querySelector('uc-modal#start-from uc-drop-area') as HTMLElement;
    expect(dropArea).toBeTruthy();
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/uri-list', TEST_IMAGE_URL);
    dropArea.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }));

    await expect.poll(() => api.getOutputCollectionState().allEntries.length).toBeGreaterThan(0);
    // Collection growth is what gates `router.traverse('onFileAdd')` in
    // DropArea.ts's `onItems` callback — the router leaving start-from is
    // the observable proxy for that traversal having fired.
    await expect.poll(() => document.querySelector('uc-start-from')?.hasAttribute('active')).toBe(false);
  });

  it('a drop that adds no items (drag-state ping-pong with no dataTransfer) does not advance the router', async () => {
    const { api } = renderRegularWithProvider();

    await page.getByText('Upload files', { exact: true }).click();
    await expect.element(page.getByTestId('uc-start-from')).toBeVisible();
    await expect.poll(() => document.querySelector('uc-start-from')?.hasAttribute('active')).toBe(true);

    const dropArea = document.querySelector('uc-modal#start-from uc-drop-area') as HTMLElement;
    const emptyDataTransfer = new DataTransfer();
    dropArea.dispatchEvent(new DragEvent('drop', { dataTransfer: emptyDataTransfer, bubbles: true, cancelable: true }));

    // Give the (absent) traversal a chance to happen before asserting the
    // negative — DropArea.ts's `onItems` returns early when `items.length`
    // is falsy, so `router.traverse('onFileAdd')` never fires and start-from
    // stays active/foreground.
    await expect.poll(() => api.getOutputCollectionState().allEntries.length).toBe(0);
    expect(document.querySelector('uc-start-from')?.hasAttribute('active')).toBe(true);
  });
});

describe('uc-drop-area — click / keyboard (clickable)', () => {
  // `openSystemDialog` (src/abstract/UploaderPublicApi.ts) appends a real
  // `[uploadcare-file-input]` to `document.body` outside any test-renderer
  // container, so it survives across tests unless explicitly swept.
  beforeEach(() => {
    document.querySelectorAll('[uploadcare-file-input]').forEach((el) => {
      el.remove();
    });
  });

  // Boolean JSX attrs don't reliably stick (see AGENTS.md / sibling suites'
  // convention, e.g. source-btn.e2e.test.tsx) — drive `clickable` via the JS
  // property after mount instead. `_updateClickableListeners` (which
  // attaches the keydown/click listeners) runs from Lit's `updated()`
  // lifecycle, so the property set must be flushed via `updateComplete`
  // before dispatching a synthetic event, or the listener won't be attached
  // yet.
  const renderStandalone = async (props: { clickable?: boolean } = {}) => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-drop-area ctx-name={ctxName}></uc-drop-area>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </>,
    );
    const config = page.getByTestId('uc-config').query()! as Config;
    const dropArea = page.getByTestId('uc-drop-area').query()! as DropArea;
    if (props.clickable) {
      dropArea.clickable = true;
      await dropArea.updateComplete;
    }
    return { ctxName, config, dropArea };
  };

  it('without clickable, a click does nothing (no system dialog, no navigation)', async () => {
    const { dropArea } = await renderStandalone({ clickable: false });

    await userEvent.click(dropArea);
    // Give any (incorrect) async reaction a chance to happen before asserting
    // the negative.
    await expect.poll(() => document.querySelector('[uploadcare-file-input]')).toBeNull();
    expect(document.querySelector('[uploadcare-file-input]')).toBeNull();
  });

  it('with clickable and no initflow, a click opens the native system dialog (a file input is appended)', async () => {
    const { dropArea } = await renderStandalone({ clickable: true });

    await userEvent.click(dropArea);
    await expect.poll(() => document.querySelector('[uploadcare-file-input]')).toBeTruthy();
  });

  it('with clickable and no initflow, Enter/Space keydown also opens the system dialog', async () => {
    const { dropArea } = await renderStandalone({ clickable: true });

    dropArea.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }));
    await expect.poll(() => document.querySelector('[uploadcare-file-input]')).toBeTruthy();

    document.querySelector('[uploadcare-file-input]')?.remove();

    dropArea.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    await expect.poll(() => document.querySelector('[uploadcare-file-input]')).toBeTruthy();
  });

  it('a keydown with an unrelated key does not open the system dialog', async () => {
    const { dropArea } = await renderStandalone({ clickable: true });

    dropArea.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', bubbles: true }));
    expect(document.querySelector('[uploadcare-file-input]')).toBeNull();
  });

  it('with clickable and initflow, a click calls api.initFlow() (opens start-from) instead of the system dialog', async () => {
    // FileUploaderMinimal's inline (non-modal) drop-area is rendered with
    // both `initflow` and `clickable` (src/solutions/file-uploader/minimal/
    // FileUploaderMinimal.ts) — the real composition that exercises this
    // exact combination, so we drive it through the actual solution rather
    // than approximating the wiring by hand.
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-minimal ctx-name={ctxName}></uc-file-uploader-minimal>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );
    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = ctxProvider.getAPI();

    // Two `uc-drop-area`s render for minimal (the inline `initflow clickable`
    // one, and the modal's `with-icon clickable` one); the inline one renders
    // first in DOM order (see FileUploaderMinimal.ts's render(): the inline
    // `<uc-start-from>` precedes the `<uc-modal id="start-from">`).
    const initflowDropArea = page.getByTestId('uc-drop-area').first();
    await expect.element(initflowDropArea).toBeInTheDocument();

    await userEvent.click(initflowDropArea);

    // api.initFlow() with an empty collection opens the modal start-from
    // flow rather than the native system dialog.
    await expect
      .poll(() => document.querySelector('uc-modal#start-from uc-start-from')?.hasAttribute('active'))
      .toBe(true);
    expect(document.querySelector('[uploadcare-file-input]')).toBeNull();
    expect(api.getOutputCollectionState().allEntries.length).toBe(0);
  });
});

describe('uc-drop-area — enable / visibility / _shouldIgnore proxies', () => {
  const renderStandalone = () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-drop-area ctx-name={ctxName}></uc-drop-area>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </>,
    );
    const config = page.getByTestId('uc-config').query()! as Config;
    const dropArea = page.getByTestId('uc-drop-area').query()! as DropArea;
    return { ctxName, config, dropArea };
  };

  it('disabled hides the drop-area when it renders its own default slot', async () => {
    const { dropArea } = renderStandalone();
    await expect.poll(() => dropArea.hidden).toBe(false);

    dropArea.disabled = true;
    await expect.poll(() => dropArea.hidden).toBe(true);

    dropArea.disabled = false;
    await expect.poll(() => dropArea.hidden).toBe(false);
  });

  it('disabled does NOT hide the drop-area when it has custom light-DOM children (no default slot rendered)', async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-drop-area ctx-name={ctxName} disabled>
          <span class="custom-child">custom</span>
        </uc-drop-area>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </>,
    );
    const dropArea = page.getByTestId('uc-drop-area').query()! as DropArea;
    await expect.poll(() => document.querySelector('uc-drop-area [data-default-slot]')).toBeNull();
    await expect.poll(() => dropArea.hidden).toBe(false);
  });

  it('a sourceList without "local" disables the drop-area (hidden, same as disabled)', async () => {
    const { config, dropArea } = renderStandalone();
    await expect.poll(() => dropArea.hidden).toBe(false);

    config.sourceList = 'url, camera';
    await expect.poll(() => dropArea.hidden).toBe(true);

    config.sourceList = 'local, url';
    await expect.poll(() => dropArea.hidden).toBe(false);
  });

  it('multiple:false plus an existing file blocks further drop handling (drag-state never advances past inactive)', async () => {
    const { config, dropArea } = renderStandalone();
    config.multiple = false;

    // Drive the real config-driven public API to add one file so the
    // collection is non-empty, then confirm a synthetic dragenter/dragover
    // on the (now un-handleable) drop-area is ignored: `shouldIgnore()`
    // (private) gates `addDropzone`'s `setState`, so the observable proxy is
    // that `drag-state` never leaves "inactive".
    const dropAreaContainer = (dropArea as unknown as { container: ControllerContainer }).container;
    dropAreaContainer.get(UploaderPublicApi).addFileFromUrl(TEST_IMAGE_URL);
    await expect.poll(() => dropAreaContainer.get(UploadCollectionController).size).toBe(1);

    dropArea.dispatchEvent(new Event('dragenter', { bubbles: true }));
    dropArea.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));

    expect(dropArea.getAttribute('drag-state')).toBe('inactive');
  });
});

describe('uc-drop-area — drop text', () => {
  const renderStandalone = () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-drop-area ctx-name={ctxName}></uc-drop-area>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </>,
    );
    const config = page.getByTestId('uc-config').query()! as Config;
    const dropArea = page.getByTestId('uc-drop-area').query()! as DropArea;
    return { ctxName, config, dropArea };
  };

  it('defaults to the "Drop files here" locale string when multiple is true', async () => {
    const { dropArea } = renderStandalone();
    await expect.poll(() => dropArea.querySelector('.uc-text')?.textContent).toBe('Drop files here');
  });

  it('falls back to the "Drop file here" (singular) locale string when multiple is false', async () => {
    const { config, dropArea } = renderStandalone();
    config.multiple = false;
    await expect.poll(() => dropArea.querySelector('.uc-text')?.textContent).toBe('Drop file here');
  });

  it('the "text" attribute overrides the locale-derived text', async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-drop-area ctx-name={ctxName} text="Custom drop text"></uc-drop-area>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </>,
    );
    const dropArea = page.getByTestId('uc-drop-area').query()! as DropArea;
    await expect.poll(() => dropArea.querySelector('.uc-text')?.textContent).toBe('Custom drop text');
  });
});
