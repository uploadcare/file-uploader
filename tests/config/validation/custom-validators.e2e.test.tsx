import { describe, expect, it, vi } from 'vitest';
import type { FileValidators, FuncFileValidator } from '@/index';
import { delay } from '@/utils/delay';
import '~/types/jsx';
import { IMAGE, testFile } from '~/tests/fixtures/files';
import { emulatorSession, isLive } from '~/tests/utils/emulator.browser';
import { renderSolution, within } from '~/tests/utils/render-solution';
import { applyMirror } from './editor';

describe('validation: custom validators', () => {
  describe('validator descriptors', () => {
    it('accepts a custom validator descriptor', async () => {
      const customValidator = vi.fn(() => ({ message: 'Bad image' }));
      const { api, root } = await renderSolution('regular', {
        fileValidators: [{ validator: customValidator, runOn: 'change' }],
      });
      api.addFileFromObject(testFile('badfile.jpg'));
      api.initFlow();
      await expect.element(within(root).getByText('Bad image')).toBeVisible();
      expect(customValidator).toHaveBeenCalled();
    });

    it('runs a "change" validator even when the previous "add" validator failed', async () => {
      const customChangeValidator = vi.fn(() => ({ message: 'Change error' }));
      const customAddValidator = vi.fn(() => ({ message: 'Add error' }));
      const { api } = await renderSolution('regular', {
        fileValidators: [
          { validator: customAddValidator, runOn: 'add' },
          { validator: customChangeValidator, runOn: 'change' },
        ],
      });
      api.addFileFromObject(testFile('badfile.jpg'));
      api.initFlow();
      await expect.poll(() => customAddValidator).toHaveBeenCalled();
      await expect.poll(() => customChangeValidator).toHaveBeenCalled();
    });

    describe('runOn: "add"', () => {
      it('runs the validator once on add during the whole upload', async () => {
        const customValidator = vi.fn(() => undefined);
        const { api } = await renderSolution('regular', {
          fileValidators: [{ validator: customValidator, runOn: 'add' }],
        });
        api.addFileFromObject(IMAGE.PIXEL);
        api.initFlow();
        await expect.poll(() => api.getOutputCollectionState().status, { timeout: 10000 }).toBe('success');
        expect(customValidator).toHaveBeenCalledTimes(1);
      });

      it('does not re-run the validator on a cdnUrl change (image edit)', async () => {
        const customValidator = vi.fn(() => undefined);
        const { api, root } = await renderSolution('regular', {
          fileValidators: [{ validator: customValidator, runOn: 'add' }],
        });
        api.addFileFromObject(IMAGE.SQUARE);
        api.initFlow();
        await applyMirror(root);

        expect(customValidator).toHaveBeenCalledTimes(1);
      });
    });

    describe('runOn: "upload"', () => {
      it('runs the validator once on upload during the whole upload', async () => {
        const customValidator = vi.fn(() => undefined);
        const { api } = await renderSolution('regular', {
          fileValidators: [{ validator: customValidator, runOn: 'upload' }],
        });
        api.addFileFromObject(IMAGE.PIXEL);
        api.initFlow();
        await expect.poll(() => api.getOutputCollectionState().status, { timeout: 10000 }).toBe('success');
        await expect.poll(() => customValidator).toHaveBeenCalledTimes(1);
      });
    });

    describe('runOn: "change"', () => {
      it('runs the validator on every file change', async () => {
        const customValidator = vi.fn(() => undefined);
        const { api } = await renderSolution('regular', {
          fileValidators: [{ validator: customValidator, runOn: 'change' }],
        });
        api.addFileFromObject(IMAGE.PIXEL);
        api.initFlow();
        await expect.poll(() => api.getOutputCollectionState().status, { timeout: 3000 }).toBe('success');
        await expect.poll(() => customValidator.mock.calls.length).toBeGreaterThan(1);
      });

      it('re-runs the validator on a cdnUrl change (image edit)', async () => {
        const customValidator = vi.fn(() => undefined);
        const { api, root } = await renderSolution('regular', {
          fileValidators: [{ validator: customValidator, runOn: 'change' }],
        });
        api.addFileFromObject(IMAGE.SQUARE);
        api.initFlow();
        await within(root).getByLabelText('Edit', { exact: true }).click();
        await within(root).getByLabelText('Apply mirror operation', { exact: true }).click();
        const callsBeforeEdit = customValidator.mock.calls.length;
        await within(root).getByRole('button', { name: /apply/i }).click();
        await expect.poll(() => customValidator.mock.calls.length).toBe(callsBeforeEdit + 1);
      });
    });
  });

  describe('async file validators', () => {
    it('shows an error when the validator fails', async () => {
      const { api, root } = await renderSolution('regular', {
        fileValidators: [
          async (file) => {
            if (file.name === 'badfile.jpg') {
              return { message: 'Bad image' };
            }
          },
        ],
      });
      api.addFileFromObject(testFile('badfile.jpg'));
      api.initFlow();
      await expect.element(within(root).getByText('Bad image')).toBeVisible();
      await expect.element(within(root).getByText('1 error')).toBeVisible();
    });

    it('skips async validation on timeout', async () => {
      const { api, root } = await renderSolution('regular', {
        validationTimeout: 100,
        fileValidators: [
          // Fails only once the timeout has aborted it, so its result always comes too late.
          (_entry, _api, options) =>
            new Promise((resolve) =>
              options?.signal?.addEventListener('abort', () => resolve({ message: 'Bad image' })),
            ),
        ],
      });
      api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await expect.element(within(root).getByText('1 file uploaded')).toBeVisible();
    });

    it('skips async validation when it throws', async () => {
      const { api, root } = await renderSolution('regular', {
        fileValidators: [
          async () => {
            throw new Error('Some error');
          },
        ],
      });
      api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await expect.element(within(root).getByText('1 file uploaded')).toBeVisible();
    });

    it('aborts async validation when the file is removed', async () => {
      // Settles only when aborted, so the file is removed while it runs.
      const validator = vi.fn<FuncFileValidator>(
        (_entry, _api, options) =>
          new Promise((resolve) => options?.signal?.addEventListener('abort', () => resolve({ message: 'Bad image' }))),
      );
      const { api } = await renderSolution('regular', { fileValidators: [validator] });
      const entry = api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await expect.poll(() => validator).toHaveBeenCalled();
      api.removeFileByInternalId(entry.internalId);
      await expect
        .poll(() => validator)
        .toHaveBeenLastCalledWith(
          expect.objectContaining({ errors: [] }),
          expect.anything(),
          expect.objectContaining({ signal: expect.toSatisfy((s) => s.aborted) }),
        );
    });
  });

  describe('sync file validators', () => {
    it('shows an error when the validator fails', async () => {
      const { api, root } = await renderSolution('regular', {
        fileValidators: [
          (file) => {
            if (file.name === 'badfile.jpg') {
              return { message: 'Bad image' };
            }
          },
        ],
      });
      api.addFileFromObject(IMAGE.PIXEL);
      api.addFileFromObject(testFile('badfile.jpg'));
      api.initFlow();
      await expect.element(within(root).getByText('Bad image')).toBeVisible();
      await expect.element(within(root).getByLabelText('File pixel.jpg in status finished')).toBeVisible();
    });

    it('runs multiple times during upload', async () => {
      const validator = vi.fn<FuncFileValidator>(() => undefined);
      const { api } = await renderSolution('regular', { fileValidators: [validator] });
      api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await expect.poll(() => validator.mock.calls.at(-1)?.[0].status, { timeout: 10000 }).toBe('success');

      expect(validator.mock.calls.length).toBeGreaterThan(1);
      expect(validator.mock.calls[0]).toEqual([
        expect.objectContaining({ status: 'idle' }),
        expect.anything(),
        expect.anything(),
      ]);
      expect(validator.mock.calls.at(-1)).toEqual([
        expect.objectContaining({ status: 'success' }),
        expect.anything(),
        expect.anything(),
      ]);
    }, 20000);

    it('runs when cdnUrl or cdnUrlModifiers change', async () => {
      const validator = vi.fn(() => undefined);
      const { api, root } = await renderSolution('regular', { fileValidators: [validator] });
      api.addFileFromObject(IMAGE.SQUARE);
      api.initFlow();

      await expect
        .poll(() => validator, {
          // The validator fires with `cdnUrlModifiers: ''` only once the real
          // upload completes; 5s is flaky, match the upload waits above.
          timeout: 10000,
        })
        .toHaveBeenLastCalledWith(
          expect.objectContaining({ cdnUrlModifiers: '' }),
          expect.anything(),
          expect.anything(),
        );

      await applyMirror(root);

      await expect
        .poll(() => validator, { timeout: 5000 })
        .toHaveBeenLastCalledWith(
          expect.objectContaining({
            cdnUrlModifiers: '-/mirror/-/preview/',
            cdnUrl: expect.stringContaining('-/mirror/-/preview/'),
          }),
          expect.anything(),
          expect.anything(),
        );
    });
  });

  // `uploadAll()` right after `addFileFromObject()` takes the entry before any validator has started.
  describe.skipIf(isLive)('an upload requested in the same tick as the add', () => {
    const uploadRequests = (): string[] => {
      const log: string[] = [];
      emulatorSession().on('POST /base/', () => {
        log.push('upload');
        return undefined;
      });
      return log;
    };

    const addAndUpload = async (fileValidators: FileValidators, confirmUpload = true) => {
      const { api } = await renderSolution('regular', { confirmUpload, fileValidators });
      api.addFileFromObject(IMAGE.PIXEL);
      if (confirmUpload) api.uploadAll();
      return api;
    };

    for (const [name, validator] of [
      ['a plain function', () => ({ message: 'Bad image' })],
      ['a "change" descriptor', { runOn: 'change', validator: () => ({ message: 'Bad image' }) }],
      ['an "add" descriptor', { runOn: 'add', validator: () => ({ message: 'Bad image' }) }],
      ['an async function', async () => ({ message: 'Bad image' })],
    ] as const) {
      it(`does not upload a file that ${name} validator rejects`, async () => {
        const requests = uploadRequests();
        const api = await addAndUpload([validator]);
        await expect.poll(() => api.getOutputCollectionState().allEntries[0]?.status).toBe('failed');
        expect(requests).toEqual([]);
      });
    }

    it('does not upload a rejected file when the list uploads on its own', async () => {
      const requests = uploadRequests();
      const api = await addAndUpload([() => ({ message: 'Bad image' })], false);
      await expect.poll(() => api.getOutputCollectionState().allEntries[0]?.status).toBe('failed');
      expect(requests).toEqual([]);
    });

    it('uploads a file that an "add" validator accepts', async () => {
      const api = await addAndUpload([{ runOn: 'add', validator: () => undefined }]);
      await expect.poll(() => api.getOutputCollectionState().status, { timeout: 10000 }).toBe('success');
    });

    it('starts the upload once a slow validator accepts the file', async () => {
      const log = uploadRequests();
      const api = await addAndUpload([
        async () => {
          log.push('validator-start');
          await delay(300);
          log.push('validator-end');
          return undefined;
        },
      ]);
      await expect.poll(() => api.getOutputCollectionState().status, { timeout: 10000 }).toBe('success');
      expect(log.slice(0, 3)).toEqual(['validator-start', 'validator-end', 'upload']);
    });
  });

  describe('custom collection validation', () => {
    it('shows an error when the collection validator fails', async () => {
      const { api, root } = await renderSolution('regular', {
        collectionValidators: [() => ({ message: 'Bad collection' })],
      });
      api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await expect.element(within(root).getByText('Bad collection')).toBeVisible();
    });

    it('toggles the error as the collection changes and re-validates', async () => {
      const { api, root } = await renderSolution('regular', {
        collectionValidators: [
          (collection) => {
            if (collection.totalCount !== 2) {
              return { message: 'Bad collection' };
            }
          },
        ],
      });
      api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await expect.element(within(root).getByText('Bad collection')).toBeVisible();
      api.addFileFromObject(IMAGE.PIXEL);
      await expect.element(within(root).getByText('Bad collection')).not.toBeInTheDocument();
    });
  });
});
