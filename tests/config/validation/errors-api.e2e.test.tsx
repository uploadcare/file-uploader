import { describe, expect, it, vi } from 'vitest';
import type { FuncFileValidator, OutputErrorCollection, OutputErrorFile } from '@/index';
import '~/types/jsx';
import { IMAGE, testFile } from '~/tests/fixtures/files';
import { renderSolution } from '~/tests/utils/render-solution';
import { applyMirror } from './editor';

describe('validation: errors API', () => {
  describe('file errors', () => {
    it('collects every validation error in the `errors` property of the file', async () => {
      const { api } = await renderSolution('regular', {
        imgOnly: true,
        accept: 'image/png',
        maxLocalFileSizeBytes: 1,
        fileValidators: [() => ({ message: 'Bad file' })],
      });
      const entry = api.addFileFromObject(testFile('badfile.txt', 'text/plain'));
      api.initFlow();

      await expect
        .poll(() => api.getOutputItem(entry.internalId).errors)
        .toEqual(
          expect.arrayContaining([
            expect.objectContaining<Partial<OutputErrorFile>>({ type: 'NOT_AN_IMAGE' }),
            expect.objectContaining<Partial<OutputErrorFile>>({ type: 'FORBIDDEN_FILE_TYPE' }),
            expect.objectContaining<Partial<OutputErrorFile>>({ type: 'FILE_SIZE_EXCEEDED' }),
            expect.objectContaining<Partial<OutputErrorFile>>({ type: 'CUSTOM_ERROR' }),
          ]),
        );
    });

    it('provides upload errors', async () => {
      const { api } = await renderSolution('regular');
      const entry = api.addFileFromUrl('https://fake-domain-that-will-404.com/image.jpg');
      api.initFlow();
      await expect
        .poll(() => api.getOutputItem(entry.internalId).errors, { timeout: 5000 })
        .toEqual(expect.arrayContaining([expect.objectContaining<Partial<OutputErrorFile>>({ type: 'UPLOAD_ERROR' })]));
    });

    it('toggles errors in the `errors` property of the file on file change', async () => {
      const customValidator = vi.fn<FuncFileValidator>((entry) => {
        if (entry.cdnUrlModifiers?.includes('mirror')) {
          return { message: 'Bad image' };
        }
      });
      const { api, root } = await renderSolution('regular', {
        fileValidators: [{ validator: customValidator, runOn: 'change' }],
      });
      const entry = api.addFileFromObject(IMAGE.SQUARE);
      api.initFlow();

      // Apply mirror and check for error
      await applyMirror(root);
      await expect
        .poll(() => api.getOutputItem(entry.internalId).errors)
        .toEqual(expect.arrayContaining([expect.objectContaining<Partial<OutputErrorFile>>({ type: 'CUSTOM_ERROR' })]));

      // Remove mirror and check for error gone
      await applyMirror(root);
      await expect.poll(() => api.getOutputItem(entry.internalId).errors).toEqual([]);

      // Apply mirror and check for error again
      await applyMirror(root);
      await expect
        .poll(() => api.getOutputItem(entry.internalId).errors)
        .toEqual(expect.arrayContaining([expect.objectContaining<Partial<OutputErrorFile>>({ type: 'CUSTOM_ERROR' })]));
    }, 30000);

    it('provides errors from both "add" and "change" validators', async () => {
      const { api } = await renderSolution('regular', {
        fileValidators: [
          { runOn: 'add', validator: () => ({ message: 'Add error' }) },
          { runOn: 'change', validator: () => ({ message: 'Change error' }) },
        ],
      });
      const entry = api.addFileFromObject(IMAGE.SQUARE);
      api.initFlow();

      await expect
        .poll(() => api.getOutputItem(entry.internalId).errors, { timeout: 3000 })
        .toEqual(
          expect.arrayContaining([
            expect.objectContaining<Partial<OutputErrorFile>>({ message: 'Add error' }),
            expect.objectContaining<Partial<OutputErrorFile>>({ message: 'Change error' }),
          ]),
        );
    });
  });

  describe('upload collection errors', () => {
    it('populates the collection errors with the common file validation error', async () => {
      const { api } = await renderSolution('regular', { fileValidators: [() => ({ message: 'Bad file' })] });
      api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();

      await expect
        .poll(() => api.getOutputCollectionState().errors)
        .toEqual(
          expect.arrayContaining([
            expect.objectContaining<Partial<OutputErrorCollection>>({ type: 'SOME_FILES_HAS_ERRORS' }),
          ]),
        );
    });
  });
});
