import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { Config, UploadCtxProvider } from '@/index.ts';
import { TEST_IMAGE_URL } from '../utils/constants';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

// M9f Task 3 — additive parity e2e pinning current v1 behavior of
// `uc-start-from` (activity reflection via `LitActivityBlock`) and
// `uc-activity-header` (an inert `LitActivityBlock` subclass with no
// `activityType` — see src/blocks/ActivityHeader/ActivityHeader.ts) ahead of
// the `LitActivityBlock` -> `ActivityChildBlock` swap. Mounts the regular
// solution + `<uc-upload-ctx-provider>` (same composition as
// tests/blocks/file-item.e2e.test.tsx / upload-events-wiring.e2e.test.tsx)
// and drives real navigation through the public api, asserting only against
// rendered DOM / documented api surface.
//
// Disclosure: the brief's case-2 driver as described — "with the modal open,
// api.addFileFromUrl(TEST_IMAGE_URL) triggers onFileAdd navigation to
// upload-list" — does not hold: `addFileFromUrl` only mutates the upload
// collection (src/abstract/UploaderPublicApi.ts) and never itself calls
// `router.traverse('onFileAdd')`; that traversal is wired only from
// UI-driven source flows (DropArea drop, UrlSource/ExternalSource/
// CameraSource submit) and the public api's `openSystemDialog` change
// handler (see grep for `traverse('onFileAdd')` across src/blocks +
// src/abstract/UploaderPublicApi.ts). A bare `addFileFromUrl()` call left
// `uc-start-from` active with no navigation (verified empirically). The
// actual v1 driver that navigates away from `start-from` once a file exists
// is `UploaderPublicApi.initFlow()` (src/abstract/UploaderPublicApi.ts:312),
// which — when the upload collection is non-empty — calls
// `router.navigate(ACTIVITY_TYPES.UPLOAD_LIST)` directly; this is the same
// call the "Upload files" button issues (see file-item.e2e.test.tsx's
// comment on `api.initFlow()`). Case 2 below uses
// `api.addFileFromUrl(...)` followed by `api.initFlow()` as the real,
// non-timed navigation driver.

const renderRegularHost = () => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
      <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
    </>,
  );
  const config = page.getByTestId('uc-config').query()! as Config;
  const provider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
  return { ctxName, config, api: provider.api };
};

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

describe('uc-start-from (parity, activity reflection)', () => {
  it('becomes visible with activity="start-from" and [active] when the modal opens', async () => {
    renderRegularHost();

    await page.getByText('Upload files', { exact: true }).click();

    const startFrom = page.getByTestId('uc-start-from');
    await expect.element(startFrom).toBeVisible();
    await expect.poll(() => document.querySelector('uc-start-from')?.getAttribute('activity')).toBe('start-from');
    await expect.poll(() => document.querySelector('uc-start-from')?.hasAttribute('active')).toBe(true);
  });

  it('loses [active] but stays in the DOM once navigation moves to upload-list', async () => {
    const { api } = renderRegularHost();

    await page.getByText('Upload files', { exact: true }).click();
    await expect.element(page.getByTestId('uc-start-from')).toBeVisible();
    await expect.poll(() => document.querySelector('uc-start-from')?.hasAttribute('active')).toBe(true);

    // Real navigation driver — see file-level disclosure comment above.
    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    await expect.poll(() => document.querySelector('uc-start-from')?.hasAttribute('active')).toBe(false);
    // Still owns its slot attribute — only [active] is toggled off.
    expect(document.querySelector('uc-start-from')?.getAttribute('activity')).toBe('start-from');
    // Remains mounted, just not the active/foreground activity.
    expect(document.querySelector('uc-start-from')).toBeTruthy();

    await expect.poll(() => document.querySelector('uc-upload-list')?.hasAttribute('active')).toBe(true);
  });

  it('reflects data-testid under testMode', async () => {
    renderRegularHost();

    await page.getByText('Upload files', { exact: true }).click();
    await expect.element(page.getByTestId('uc-start-from')).toBeVisible();

    expect(document.querySelector('uc-start-from')?.getAttribute('data-testid')).toBe('uc-start-from');
  });
});

describe('uc-activity-header (parity, inert passthrough)', () => {
  it('carries no activity/active attributes and preserves its light-DOM children', async () => {
    const { api } = renderRegularHost();

    await page.getByText('Upload files', { exact: true }).click();
    // `uc-activity-header` is only rendered inside upload-list/url/external/
    // camera source activities (see FileUploaderRegular.ts + grep for
    // `uc-activity-header` — `uc-start-from` itself does not render one), so
    // navigate there via the same real driver as the case above.
    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();
    await expect.poll(() => document.querySelector('uc-upload-list')?.hasAttribute('active')).toBe(true);

    const header = document.querySelector('uc-upload-list uc-activity-header');
    expect(header).toBeTruthy();
    expect(header?.hasAttribute('activity')).toBe(false);
    expect(header?.hasAttribute('active')).toBe(false);

    // Light-DOM children (header text span + close button) are preserved,
    // per UploadList.ts's `<uc-activity-header>` template.
    expect(header?.querySelector('.uc-header-text')).toBeTruthy();
    expect(header?.querySelector('.uc-close-btn')).toBeTruthy();
  });

  it('reflects data-testid under testMode', async () => {
    const { api } = renderRegularHost();

    await page.getByText('Upload files', { exact: true }).click();
    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();
    await expect.poll(() => document.querySelector('uc-upload-list')?.hasAttribute('active')).toBe(true);

    await expect
      .poll(() => document.querySelector('uc-upload-list uc-activity-header')?.getAttribute('data-testid'))
      .toBe('uc-activity-header');
  });
});
