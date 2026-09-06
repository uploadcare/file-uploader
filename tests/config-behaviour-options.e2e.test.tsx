import type { UploadcareFile } from '@uploadcare/upload-client';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FuncFileValidator } from '@/index';
import { delay } from '@/utils/delay';
import { IMAGE } from './fixtures/files';
import { renderSolution } from './utils/render-solution';
import '../types/jsx';

/**
 * The documented options whose effect is neither a plain pass-through to upload-client nor a rendered attribute:
 * `imageShrink`, `pasteScope` and `validationConcurrency`.
 *
 * `dynamicButtonShowFirstIcon` is deliberately not here. It only takes effect once `PrimaryAction` has a resolved
 * single source — with none, the default upload icon renders regardless (PrimaryAction.ts:155) — and driving the
 * button to that state needs the dynamic-button attribute set at parse time plus the plugin manager ready. A test
 * that skips that setup asserts the wrong branch and passes for the wrong reason.
 *
 * `uploadFile` is stubbed so the shrink assertions can inspect the file that would have been sent, with no network.
 */

const uploadFile = vi.hoisted(() => vi.fn());

vi.mock('@uploadcare/upload-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uploadcare/upload-client')>();
  return { ...actual, uploadFile };
});

const UPLOADED = {
  uuid: '00000000-0000-4000-8000-000000000000',
  originalFilename: 'square.jpg',
  size: 1,
  isImage: true,
  mimeType: 'image/jpeg',
} as unknown as UploadcareFile;

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

beforeEach(() => {
  uploadFile.mockReset();
  uploadFile.mockResolvedValue(UPLOADED);
});

describe('imageShrink', () => {
  /** The file that actually reached the upload call. */
  const uploadedFile = async (imageShrink?: string): Promise<File> => {
    uploadFile.mockClear();
    const { api } = await renderSolution('regular', imageShrink ? { imageShrink } : {});
    api.addFileFromObject(IMAGE.SQUARE);
    api.uploadAll();

    await vi.waitFor(() => expect(uploadFile).toHaveBeenCalled(), { timeout: 20_000 });
    return uploadFile.mock.calls[0][0] as File;
  };

  it('uploads the original file when unset', async () => {
    expect(await uploadedFile()).toBe(IMAGE.SQUARE);
  });

  it('replaces the file with a shrunk one when set', async () => {
    const file = await uploadedFile('100x100');

    expect(file).not.toBe(IMAGE.SQUARE);
    expect(file.size).toBeLessThan(IMAGE.SQUARE.size);
  });

  it('leaves the file alone when the setting cannot be parsed', async () => {
    // The plugin warns and passes the file through rather than failing the upload
    // (src/plugins/imageShrinkPlugin.ts:17).
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(await uploadedFile('not-a-size')).toBe(IMAGE.SQUARE);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('pasteScope', () => {
  const pasteInto = async (target: Element) => {
    const data = new DataTransfer();
    data.items.add(IMAGE.PIXEL);
    target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, composed: true }));
    await delay(300);
  };

  it("accepts a paste inside the uploader on the default 'local' scope", async () => {
    const { root, api, config } = await renderSolution('regular');
    expect(config.pasteScope).toBe('local');

    await pasteInto(root);

    await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(1);
  });

  it("ignores a paste outside the uploader on 'local'", async () => {
    const { api } = await renderSolution('regular');

    await pasteInto(document.body);

    expect(api.getOutputCollectionState().totalCount).toBe(0);
  });

  it("accepts a paste anywhere on 'global'", async () => {
    const { api } = await renderSolution('regular', { pasteScope: 'global' });

    await pasteInto(document.body);

    await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(1);
  });

  it('ignores paste entirely when disabled', async () => {
    const { root, api } = await renderSolution('regular', { pasteScope: false });

    await pasteInto(root);

    expect(api.getOutputCollectionState().totalCount).toBe(0);
  });
});

describe('validationConcurrency', () => {
  /** Runs three files through a slow async validator and reports the highest number in flight at once. */
  const peakConcurrency = async (validationConcurrency: number): Promise<number> => {
    let inFlight = 0;
    let peak = 0;

    const validator: FuncFileValidator = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await delay(150);
      inFlight -= 1;
      return undefined;
    };

    const { api } = await renderSolution('regular', { validationConcurrency, fileValidators: [validator] });
    for (let i = 0; i < 3; i += 1) {
      api.addFileFromObject(new File(['x'], `file-${i}.jpg`, { type: 'image/jpeg' }));
    }

    await vi.waitFor(() => expect(peak).toBeGreaterThan(0), { timeout: 10_000 });
    await delay(1000);
    return peak;
  };

  it('runs validators one at a time when set to 1', async () => {
    expect(await peakConcurrency(1)).toBe(1);
  });

  it('runs them in parallel when allowed', async () => {
    expect(await peakConcurrency(3)).toBeGreaterThan(1);
  });
});
