import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { Config, Thumb, UploadCtxProvider } from '@/index.ts';
import { TRANSPARENT_PIXEL_SRC } from '../../src/utils/transparentPixelSrc';
import { TEST_IMAGE_URL } from '../utils/constants';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

// M9e Task 2 — additive parity e2e pinning current v1 `uc-thumb` behavior
// ahead of the FileItem/Thumb family port.

const renderUploadHost = () => {
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

// Standalone-block composition (same shape as tests/blocks/progress-bar.e2e.test.tsx
// / spinner.e2e.test.tsx) for the entry-less Thumb cases, which need no upload
// collection at all.
const renderStandaloneThumb = () => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-thumb ctx-name={ctxName}></uc-thumb>
      <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
  const thumb = document.querySelector('uc-thumb')! as Thumb;
  return { ctxName, thumb };
};

const thumbImg = () => document.querySelector('uc-thumb img.uc-thumb__img') as HTMLImageElement | null;

describe('uc-thumb (parity, real upload flow)', () => {
  it('gains a non-transparent img src and un-hides after a successful image upload', async () => {
    const { api } = renderUploadHost();
    api.addFileFromUrl(TEST_IMAGE_URL);
    // `initFlow()` opens the modal (same call the "Upload files" button
    // issues); without it the item exists in the DOM but its
    // IntersectionObserver never reports intersecting while the dialog is
    // closed, so the thumb never renders.
    api.initFlow();
    api.uploadAll();

    await expect.poll(() => api.getOutputCollectionState().successCount, { timeout: 20_000 }).toBe(1);

    await expect
      .poll(
        () => (thumbImg()?.hasAttribute('src') ? thumbImg()!.getAttribute('src') !== TRANSPARENT_PIXEL_SRC : false),
        {
          timeout: 20_000,
        },
      )
      .toBe(true);
    await expect.poll(() => thumbImg()?.hasAttribute('hidden'), { timeout: 20_000 }).toBe(false);
  }, 30_000);

  it('reflects the badgeIcon property into the badge uc-icon name', async () => {
    const { thumb } = renderStandaloneThumb();

    await expect.poll(() => document.querySelector('uc-thumb .uc-badge uc-icon')).toBeTruthy();
    thumb.badgeIcon = 'badge-success';

    await expect
      .poll(() => document.querySelector('uc-thumb .uc-badge uc-icon')?.getAttribute('name'))
      .toBe('badge-success');
  });

  it('renders the transparent-pixel img without errors when mounted standalone with no entry', async () => {
    const errors: string[] = [];
    const onError = (event: ErrorEvent) => {
      errors.push(String(event.error?.message ?? event.message));
      event.preventDefault();
    };
    window.addEventListener('error', onError);

    try {
      renderStandaloneThumb();
      await expect.element(page.getByTestId('uc-thumb')).toBeInTheDocument();
      await expect.poll(() => thumbImg()?.getAttribute('src')).toBe(TRANSPARENT_PIXEL_SRC);
      expect(thumbImg()?.hasAttribute('hidden')).toBe(true);
    } finally {
      window.removeEventListener('error', onError);
    }

    expect(errors).toEqual([]);
  });
});
