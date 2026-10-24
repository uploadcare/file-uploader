import { beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { Config, UploadCtxProvider } from '@/index.ts';
import { TEST_IMAGE_URL } from '../utils/constants';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

// M9g Task 1 — additive parity e2e pinning current v1 behavior of
// `uc-url-source` (src/blocks/UrlSource/UrlSource.ts) ahead of its
// `LitUploaderBlock` port. Mounts the regular solution +
// `<uc-upload-ctx-provider>` (same composition as tests/blocks/file-item.e2e.test.tsx)
// and reaches the activity via the real "From link" start-from button,
// asserting only against rendered DOM / documented api surface. This is the
// deep suite of the three M9g source suites — it drives a real url upload
// through to `onFileAdd` navigation, condition-based waits only (no timed
// delays), same as file-item.e2e.test.tsx's real-upload cases.

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

const navigateToUrlSource = async () => {
  await page.getByText('Upload files', { exact: true }).click();
  const startFrom = page.getByTestId('uc-start-from');
  await expect.element(startFrom).toBeVisible();
  await startFrom.getByText('From link', { exact: true }).click();
  const urlSource = page.getByTestId('uc-url-source');
  await expect.element(urlSource).toBeVisible();
  return urlSource;
};

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

describe('uc-url-source (parity, real url upload flow)', () => {
  it('renders the l10n header caption + back/close buttons', async () => {
    renderRegularHost();
    await navigateToUrlSource();

    // Header caption — `caption-from-url` l10n key, en: "Import from link"
    // (src/blocks/UrlSource/UrlSource.ts's <uc-activity-header> template).
    await expect.element(page.getByText('Import from link', { exact: true })).toBeVisible();

    const backBtn = document.querySelector('uc-url-source button[title="Back"]') as HTMLButtonElement | null;
    expect(backBtn).toBeTruthy();
    expect(backBtn?.getAttribute('aria-label')).toBe('Back');

    const closeBtn = document.querySelector('uc-url-source .uc-close-btn') as HTMLButtonElement | null;
    expect(closeBtn).toBeTruthy();
    expect(closeBtn?.getAttribute('aria-label')).toBe('Close');
  });

  it('disables the submit button while the input is empty and enables it once a value is typed', async () => {
    renderRegularHost();
    const urlSource = await navigateToUrlSource();

    const submitBtn = urlSource.getByRole('button', { name: 'Import', exact: true });
    await expect.element(submitBtn).toBeDisabled();

    const urlInput = urlSource.getByPlaceholder('https://');
    await userEvent.fill(urlInput, TEST_IMAGE_URL);
    await expect.element(submitBtn).toBeEnabled();

    await userEvent.fill(urlInput, '');
    await expect.element(submitBtn).toBeDisabled();
  });

  it('submitting a url adds a file and navigates away from url-source to upload-list', async () => {
    const { api } = renderRegularHost();
    const urlSource = await navigateToUrlSource();

    const urlInput = urlSource.getByPlaceholder('https://');
    await userEvent.fill(urlInput, TEST_IMAGE_URL);
    await urlSource.getByRole('button', { name: 'Import', exact: true }).click();

    // Real backend fetch — condition-based wait, generous timeout, no timed delay.
    await expect.poll(() => api.getOutputCollectionState().totalCount, { timeout: 20_000 }).toBe(1);

    await expect.element(page.getByTestId('uc-url-source')).not.toBeInTheDocument();
    await expect.element(page.getByTestId('uc-upload-list')).toBeVisible();
  }, 30_000);

  it('reflects data-testid under testMode', async () => {
    renderRegularHost();
    await navigateToUrlSource();

    expect(document.querySelector('uc-url-source')?.getAttribute('data-testid')).toBe('uc-url-source');
  });
});
