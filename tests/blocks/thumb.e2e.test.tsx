import { beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { Config, Thumb, UploadCtxProvider } from '@/index.ts';
import type { Uid } from '../../src/abstract/Uid';
import { generateThumb } from '../../src/utils/resizeImage';
import { TRANSPARENT_PIXEL_SRC } from '../../src/utils/transparentPixelSrc';
import { IMAGE } from '../fixtures/files';
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

  // M9e regression — the ChildBlock port made `*uploadCollection` a required
  // getter; a thumb rendered outside any uploader-block scope (e.g. the
  // primary-action parity suite, which mounts a bare `<uc-thumb>` alongside
  // `<uc-config>` with no uploader/ctx-provider) has no collection registered,
  // so a truthy `uid` must fall back gracefully instead of throwing from
  // `_bindToEntry`.
  it('renders the fallback without unhandled errors when given a uid outside an uploader scope', async () => {
    const errors: string[] = [];
    const onError = (event: ErrorEvent) => {
      errors.push(String(event.error?.message ?? event.message));
      event.preventDefault();
    };
    window.addEventListener('error', onError);

    try {
      const { thumb } = renderStandaloneThumb();
      thumb.uid = 'some-uid' as Uid;

      await thumb.updateComplete;
      // Give any async/microtask-scheduled throw a moment to surface as an
      // unhandled window error before asserting.
      await expect.poll(() => thumbImg()?.getAttribute('src'), { timeout: 2_000 }).toBe(TRANSPARENT_PIXEL_SRC);
      expect(thumbImg()?.hasAttribute('hidden')).toBe(true);
    } finally {
      window.removeEventListener('error', onError);
    }

    expect(errors).toEqual([]);
  });
});

describe('uc-thumb local thumbnail', () => {
  // The thumb asks for its thumbnail when it binds to its entry and again once it is in view, 100ms later.
  it('draws the thumbnail of a local image once, however long the drawing takes', async () => {
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    let drawn = 0;
    // Slower than the second request arrives.
    HTMLCanvasElement.prototype.toBlob = function (callback, ...rest) {
      drawn++;
      setTimeout(() => toBlob.call(this, callback, ...rest), 400);
    };
    onTestFinished(() => {
      HTMLCanvasElement.prototype.toBlob = toBlob;
    });
    const { config, api } = renderUploadHost();
    config.confirmUpload = true;
    api.addFileFromObject(IMAGE.PIXEL);
    api.setCurrentActivity('upload-list');
    api.setModalState(true);

    await expect
      .poll(() => document.querySelector('img.uc-thumb__img:not([hidden])'), { timeout: 10_000 })
      .not.toBeNull();
    expect(drawn).toBe(1);
  });
});

/** Slows the last step of drawing a thumbnail down, so the test can act while one is being drawn. Returns the count. */
const slowDrawing = () => {
  const toBlob = HTMLCanvasElement.prototype.toBlob;
  let drawn = 0;
  HTMLCanvasElement.prototype.toBlob = function (callback, ...rest) {
    drawn++;
    setTimeout(() => toBlob.call(this, callback, ...rest), 400);
  };
  onTestFinished(() => {
    HTMLCanvasElement.prototype.toBlob = toBlob;
  });
  return () => drawn;
};

/** The object URLs of drawn thumbnails: those come from a canvas blob, the ones `generateThumb` decodes from a File. */
const trackThumbnailUrls = () => {
  const live = new Set<string>();
  let created = 0;
  const createObjectURL = URL.createObjectURL.bind(URL);
  vi.spyOn(URL, 'createObjectURL').mockImplementation((source) => {
    const url = createObjectURL(source);
    if (!(source instanceof File)) {
      live.add(url);
      created++;
    }
    return url;
  });
  const revokeObjectURL = URL.revokeObjectURL.bind(URL);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
    live.delete(url);
    revokeObjectURL(url);
  });
  return { live, created: () => created };
};

/** A thumb of its own for the entry, as each list row and the primary action button have. */
const mountThumb = (ctxName: string, uid: string) => {
  const thumb = document.createElement('uc-thumb');
  thumb.setAttribute('ctx-name', ctxName);
  thumb.uid = uid as Uid;
  document.body.append(thumb);
  onTestFinished(() => thumb.remove());
  return thumb;
};

describe('uc-thumb local thumbnail, across thumbs of one file', () => {
  it('draws the thumbnail once for a row that left the list while it was drawn and came back', async () => {
    const drawn = slowDrawing();
    const urls = trackThumbnailUrls();
    const { ctxName, api } = renderUploadHost();
    const { internalId } = api.addFileFromObject(IMAGE.PIXEL);

    const first = mountThumb(ctxName, internalId);
    await expect.poll(drawn).toBe(1);
    // What the virtual list does to a row scrolled out of its window and back in: a new element for the same file.
    first.remove();
    const second = mountThumb(ctxName, internalId);

    const shown = () => second.querySelector<HTMLImageElement>('img.uc-thumb__img:not([hidden])');
    await expect.poll(shown, { timeout: 10_000 }).not.toBeNull();
    expect(drawn()).toBe(1);
    expect([...urls.live]).toEqual([shown()?.src]);
  });
});

describe('generateThumb', () => {
  it.each([
    ['decodes', IMAGE.SQUARE],
    ['fails to decode', new File(['not an image'], 'broken.jpg', { type: 'image/jpeg' })],
  ])('releases the source image url once it %s', async (_, file) => {
    const create = vi.spyOn(URL, 'createObjectURL');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    onTestFinished(() => {
      vi.restoreAllMocks();
    });

    await Promise.resolve(generateThumb(file)).catch(() => {});

    expect(revoke).toHaveBeenCalledWith(create.mock.results[0]?.value);
  });
});

describe('generateThumb output', () => {
  it('resolves to a blob url for an image', async () => {
    await expect(Promise.resolve(generateThumb(IMAGE.SQUARE))).resolves.toMatch(/^blob:/);
  });

  it('rejects for a file that is not an image', async () => {
    await expect(
      Promise.resolve(generateThumb(new File(['not an image'], 'broken.jpg', { type: 'image/jpeg' }))),
    ).rejects.toBeDefined();
  });
});
