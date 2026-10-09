import { describe, expect, it, vi } from 'vitest';
import type { FuncFileValidator } from '@/index';
import { withResolvers } from '@/utils/withResolvers';
import { IMAGE } from '~/tests/fixtures/files';
import { emulatorSession, isLive } from '~/tests/utils/emulator.browser';
import { renderSolution } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * The documented options whose effect is neither a plain pass-through to upload-client nor a rendered attribute:
 * `imageShrink`, `pasteScope` and `validationConcurrency`.
 *
 * `dynamicButtonShowFirstIcon` is deliberately not here. It only takes effect once `PrimaryAction` has a resolved
 * single source — with none, the default upload icon renders regardless (PrimaryAction.ts:155) — and driving the
 * button to that state needs the dynamic-button attribute set at parse time plus the plugin manager ready. A test
 * that skips that setup asserts the wrong branch and passes for the wrong reason.
 */

// Fake-only: the bytes are read back from what the emulator stored, and a live run has no emulator.
describe.skipIf(isLive)('imageShrink', () => {
  /** The file the emulator stored for one upload of the 512×512 square. */
  const storedFile = async (imageShrink?: string) => {
    const { api } = await renderSolution('regular', imageShrink ? { imageShrink } : {});
    api.addFileFromObject(IMAGE.SQUARE);
    api.uploadAll();

    await expect.poll(() => api.getOutputCollectionState().allEntries[0]?.status, { timeout: 20_000 }).toBe('success');
    const { uuid } = api.getOutputCollectionState().allEntries[0];
    const stored = emulatorSession().files.get(uuid ?? '');
    if (!stored) throw new Error(`The emulator stored no file ${uuid}`);
    return stored;
  };

  const original = async () => new Uint8Array(await IMAGE.SQUARE.arrayBuffer());

  it('uploads the original file when unset', async () => {
    expect((await storedFile()).bytes).toEqual(await original());
  });

  it('replaces the file with a shrunk one when set', async () => {
    const { image, size } = await storedFile('100x100');

    expect(size).toBeLessThan(IMAGE.SQUARE.size);
    expect(image).toMatchObject({ width: 100, height: 100 });
  });

  it('leaves the file alone when the setting cannot be parsed', async () => {
    // The plugin warns and passes the file through rather than failing the upload
    // (src/plugins/imageShrinkPlugin.ts:17).
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await storedFile('not-a-size')).bytes).toEqual(await original());
  });
});

/** The sentinel url: a paste of it that is accepted lands after the paste under test, through the same handler. */
const SENTINEL_URL = 'https://example.com/sentinel.jpg';

const pasteSentinel = (target: Element) => {
  const data = new DataTransfer();
  data.items.add(SENTINEL_URL, 'text/plain');
  target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, composed: true }));
};

/** Everything in the collection, by url or file name; the sentinel shows up as its url. */
const added = (api: Awaited<ReturnType<typeof renderSolution>>['api']) =>
  api.getOutputCollectionState().allEntries.map((entry) => entry.externalUrl ?? entry.name);

// Which pastes are taken (url schemes, editable targets, scopes, activities) is in the happy-dom spec,
// `src/abstract/features/ClipboardLayer.test.ts`. These check the option and the paste reach a real uploader.
describe('pasteScope', () => {
  const pasteInto = async (target: Element) => {
    const data = new DataTransfer();
    data.items.add(IMAGE.PIXEL);
    target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, composed: true }));
  };

  it("accepts a paste inside the uploader on the default 'local' scope", async () => {
    const { root, api, config } = await renderSolution('regular');
    expect(config.pasteScope).toBe('local');

    await pasteInto(root);

    await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(1);
  });

  it('ignores paste entirely when disabled', async () => {
    const { root, api, config } = await renderSolution('regular', { pasteScope: false });

    await pasteInto(root);
    config.pasteScope = 'local';
    pasteSentinel(root);

    await expect.poll(() => added(api)).toEqual([SENTINEL_URL]);
  });
});

describe('validationConcurrency', () => {
  /**
   * Runs three files through a validator and reports the highest number in flight at once. Every validator holds until
   * `validationConcurrency` of them are running, so the runs overlap as far as the setting allows; a manager that let
   * fewer run at once would never get there, and the test would time out.
   */
  const peakConcurrency = async (validationConcurrency: number): Promise<number> => {
    let inFlight = 0;
    let peak = 0;
    let finished = 0;
    const allowedRunning = withResolvers();

    const validator: FuncFileValidator = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      if (inFlight >= validationConcurrency) allowedRunning.resolve();
      await allowedRunning.promise;
      inFlight -= 1;
      finished += 1;
      return undefined;
    };

    const { api } = await renderSolution('regular', { validationConcurrency, fileValidators: [validator] });
    for (let i = 0; i < 3; i += 1) {
      api.addFileFromObject(new File(['x'], `file-${i}.jpg`, { type: 'image/jpeg' }));
    }

    await expect.poll(() => finished, { timeout: 10_000 }).toBe(3);
    return peak;
  };

  it('runs validators one at a time when set to 1', async () => {
    expect(await peakConcurrency(1)).toBe(1);
  });

  it('runs them in parallel when allowed', async () => {
    expect(await peakConcurrency(3)).toBe(3);
  });
});

describe('pasting urls and text', () => {
  const pasteText = async (root: HTMLElement, text: string) => {
    const data = new DataTransfer();
    data.items.add(text, 'text/plain');
    root.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, composed: true }));
  };

  it('adds a file from a pasted http url', async () => {
    const { root, api } = await renderSolution('regular');

    await pasteText(root, 'https://example.com/photo.jpg');

    await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(1);
    expect(api.getOutputCollectionState().allEntries[0].externalUrl).toBe('https://example.com/photo.jpg');
  });
});
