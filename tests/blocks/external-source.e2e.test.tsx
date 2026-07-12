import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { Config, UploadCtxProvider } from '@/index.ts';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

// M9g Task 1 — additive parity e2e pinning current v1 behavior of
// `uc-external-source` (src/blocks/ExternalSource/ExternalSource.ts) ahead of
// its `LitUploaderBlock` port. Mounts the regular solution +
// `<uc-upload-ctx-provider>` (same composition as tests/blocks/url-source.e2e.test.tsx)
// and reaches the activity via the real "Dropbox" start-from button. Kept
// shallow per the M9g brief — pins the block's own render surface (header +
// iframe mount), not the postMessage bridge internals (already exercised via
// `tests/api.e2e.test.tsx`'s iframe-`src` assertion).
//
// Disclosure: the brief describes this activity as rendering "its l10n'd
// header for that source" with a back button that "returns to start-from".
// Neither holds for v1: `ExternalSource.render()` (ExternalSource.ts) puts
// only a single close button inside `<uc-activity-header>` — no source
// caption/icon and no back button — and that button fires
// `router.traverse('onClose')`, which is wired only to the "close everything"
// edge (see `src/abstract/controllers/RouterController.ts`'s
// `onBack`/`onCancel` vs `onClose` edge docs), not `onBack`. Empirically,
// clicking it closes the whole modal (`uc-start-from` is not left active/
// visible either) rather than returning to start-from. The cases below pin
// what's actually there instead: the close button + iframe render surface,
// and the close button's real "closes everything" effect.

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

const navigateToExternalSource = async () => {
  await page.getByText('Upload files', { exact: true }).click();
  const startFrom = page.getByTestId('uc-start-from');
  await expect.element(startFrom).toBeVisible();
  await startFrom.getByText('Dropbox', { exact: true }).click();
  const externalSource = page.getByTestId('uc-external-source');
  await expect.element(externalSource).toBeVisible();
  return externalSource;
};

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

describe('uc-external-source (parity, render surface)', () => {
  it('renders a close button and mounts an iframe pointed at the social-source base for the selected source', async () => {
    renderRegularHost();
    const externalSource = await navigateToExternalSource();

    const closeBtn = document.querySelector('uc-external-source .uc-close-btn') as HTMLButtonElement | null;
    expect(closeBtn).toBeTruthy();
    expect(closeBtn?.getAttribute('aria-label')).toBe('Close');

    // No source caption/back button — see file-level disclosure comment.
    expect(document.querySelector('uc-external-source button[title="Back"]')).toBeNull();

    await expect
      .poll(() => {
        const iframe = (externalSource.query() as HTMLElement | null)?.querySelector(
          'iframe',
        ) as HTMLIFrameElement | null;
        return iframe?.src ?? null;
        // `socialBaseUrl` defaults to `DEFAULT_SOCIAL_BASE_URL` (src/blocks/Config/initialConfig.ts);
        // the iframe src is built as `/window4/<sourceName>` under that base
        // (ExternalSource.ts's `_remoteUrl()`); `dropbox`'s sourceName equals its id.
      })
      .toMatch(/^https:\/\/social\.uploadcare\.com\/window4\/dropbox\?/);
  });

  it('clicking close closes the modal entirely (onClose, not onBack)', async () => {
    renderRegularHost();
    await navigateToExternalSource();

    (document.querySelector('uc-external-source .uc-close-btn') as HTMLButtonElement).click();

    await expect.element(page.getByTestId('uc-external-source')).not.toBeInTheDocument();
    // Not a return to start-from: the whole modal closes.
    await expect.poll(() => document.querySelector('uc-start-from')?.hasAttribute('active')).toBe(false);
  });

  it('reflects data-testid under testMode', async () => {
    renderRegularHost();
    await navigateToExternalSource();

    expect(document.querySelector('uc-external-source')?.getAttribute('data-testid')).toBe('uc-external-source');
  });
});
