import { describe, expect, it, vi } from 'vitest';
import type { FuncFileValidator } from '@/index';
import { delay } from '@/utils/delay';
import '~/types/jsx';
import { IMAGE, testFile } from '~/tests/fixtures/files';
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
            await delay(500);
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
          async () => {
            await delay(1000);
            return { message: 'Bad image' };
          },
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
            await delay(1000);
            throw new Error('Some error');
          },
        ],
      });
      api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await expect.element(within(root).getByText('1 file uploaded')).toBeVisible();
    });

    it('aborts async validation when the file is removed', async () => {
      const validator = vi.fn(async () => {
        await delay(500);
        return { message: 'Bad image' };
      });
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
