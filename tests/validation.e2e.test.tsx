import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { Config, FuncFileValidator, OutputErrorCollection, OutputErrorFile, UploadCtxProvider } from '@/index';
import { delay } from '@/utils/delay.js';
import '../types/jsx';
import { IMAGE } from './fixtures/files';
// biome-ignore lint/correctness/noUnusedImports: Used in JSX
import { renderer } from './utils/test-renderer';

beforeAll(async () => {
  // biome-ignore lint/suspicious/noTsIgnore: Ignoring TypeScript error for CSS import
  // @ts-ignore
  await import('@/solutions/file-uploader/regular/index.css');
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

beforeEach(() => {
  const ctxName = `test-${Math.random().toString(36).slice(2)}`;
  page.render(
    <>
      <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
      <uc-config qualityInsights={false} ctx-name={ctxName} testMode pubkey="demopublickey"></uc-config>
      <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
    </>,
  );
});

describe('Common file validation', () => {
  describe('imgOnly', () => {
    it('should show UI error if non-image file is uploaded', async () => {
      const config = page.getByTestId('uc-config').query()! as Config;
      config.imgOnly = true;
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = ctxProvider.getAPI();
      const file = new File(['(⌐□_□)'], 'chucknorris.txt', { type: 'text/plain' });
      api.addFileFromObject(file);
      api.initFlow();
      await expect.element(page.getByText('Only image files are accepted')).toBeVisible();
    });
  });

  describe('accept', () => {
    it('should show UI error if non-accepted file is uploaded', async () => {
      const config = page.getByTestId('uc-config').query()! as Config;
      config.accept = 'image/png';
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = ctxProvider.getAPI();
      const file = new File(['(⌐□_□)'], 'chucknorris.jpg', { type: 'image/jpeg' });
      api.addFileFromObject(file);
      api.initFlow();
      await expect.element(page.getByText('Uploading of these file types is not allowed')).toBeVisible();
    });
  });

  describe('maxLocalFileSizeBytes', () => {
    it('should show UI error if file is too large', async () => {
      const config = page.getByTestId('uc-config').query()! as Config;
      config.maxLocalFileSizeBytes = 1024;
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = ctxProvider.getAPI();
      const file = new File([new ArrayBuffer(2048)], 'largefile.jpg', { type: 'image/jpeg' });
      api.addFileFromObject(file);
      api.initFlow();
      await expect.element(page.getByText('File is too big')).toBeVisible();
    });
  });

  describe('server-side validation', () => {
    it('should show UI error if server rejects the file', async () => {
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = ctxProvider.getAPI();
      api.addFileFromUrl(`https://fake-domain-that-will-404.com/image.jpg`);
      api.initFlow();
      await expect.element(page.getByText('Host does not exist')).toBeVisible();
    });
  });
});

describe('Common upload collection validation', () => {
  describe('multiple', () => {
    it('should show UI error if multiple files are added when multiple is false', async () => {
      const config = page.getByTestId('uc-config').query()! as Config;
      config.multiple = false;
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = ctxProvider.getAPI();
      api.addFileFromObject(IMAGE.PIXEL);
      api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await expect.element(page.getByText(`You’ve chosen too many files`)).toBeVisible();
    });

    it('should show UI error if more than multipleMax files are added', async () => {
      const config = page.getByTestId('uc-config').query()! as Config;
      config.multipleMax = 2;
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = ctxProvider.getAPI();
      api.addFileFromObject(IMAGE.PIXEL);
      api.addFileFromObject(IMAGE.PIXEL);
      api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await expect.element(page.getByText(`You’ve chosen too many files`)).toBeVisible();
    });

    it('should show UI error if less than multipleMin files are added', async () => {
      const config = page.getByTestId('uc-config').query()! as Config;
      config.multipleMin = 2;
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = ctxProvider.getAPI();
      api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await expect.element(page.getByText(`At least 2 files required`)).toBeVisible();
    });
  });
});

describe('Custom file validation', () => {
  describe('Validator descriptors', () => {
    it('should be able to set custom validator descriptor', async () => {
      const config = page.getByTestId('uc-config').query()! as Config;
      const customValidator = vi.fn(() => {
        return {
          message: 'Bad image',
        };
      });
      config.fileValidators = [
        {
          validator: customValidator,
          runOn: 'change',
        },
      ];
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = ctxProvider.getAPI();
      const badFile = new File(['(⌐□_□)'], 'badfile.jpg', { type: 'image/jpeg' });
      api.addFileFromObject(badFile);
      api.initFlow();
      await expect.element(page.getByText('Bad image')).toBeVisible();
      expect(customValidator).toHaveBeenCalled();
    });

    it('should run "change" validator even if previous "add" validator failed', async () => {
      const config = page.getByTestId('uc-config').query()! as Config;
      const customChangeValidator = vi.fn(() => {
        return {
          message: 'Change error',
        };
      });
      const customAddValidator = vi.fn(() => {
        return {
          message: 'Add error',
        };
      });
      config.fileValidators = [
        {
          validator: customAddValidator,
          runOn: 'add',
        },
        {
          validator: customChangeValidator,
          runOn: 'change',
        },
      ];
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = ctxProvider.getAPI();
      const badFile = new File(['(⌐□_□)'], 'badfile.jpg', { type: 'image/jpeg' });
      api.addFileFromObject(badFile);
      api.initFlow();
      await expect.poll(() => customAddValidator).toHaveBeenCalled();
      await expect.poll(() => customChangeValidator).toHaveBeenCalled();
    });

    describe('runOn option is "add"', () => {
      it('should run validator once on file add during whole upload', async () => {
        const config = page.getByTestId('uc-config').query()! as Config;
        const customValidator = vi.fn(() => undefined);
        config.fileValidators = [
          {
            validator: customValidator,
            runOn: 'add',
          },
        ];
        const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
        const api = ctxProvider.getAPI();
        api.addFileFromObject(IMAGE.PIXEL);
        api.initFlow();
        await expect
          .poll(() => api.getOutputCollectionState().status, {
            timeout: 10000,
          })
          .toBe('success');
        expect(customValidator).toHaveBeenCalledTimes(1);
      });

      it('should not re-run validator on cdnUrl change (e.g. image edit)', async () => {
        const config = page.getByTestId('uc-config').query()! as Config;
        const customValidator = vi.fn(() => undefined);
        config.fileValidators = [
          {
            validator: customValidator,
            runOn: 'add',
          },
        ];
        const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
        const api = ctxProvider.getAPI();
        api.addFileFromObject(IMAGE.SQUARE);
        api.initFlow();
        await page.getByLabelText('Edit', { exact: true }).click();
        await page.getByLabelText('Apply mirror operation', { exact: true }).click();
        await delay(300);
        await page.getByRole('button', { name: /apply/i }).click();

        expect(customValidator).toHaveBeenCalledTimes(1);
      });
    });

    describe("runOn option is 'upload'", () => {
      it('should run validator once on file upload when runOn is "upload" during whole upload', async () => {
        const config = page.getByTestId('uc-config').query()! as Config;
        const customValidator = vi.fn(() => undefined);
        config.fileValidators = [
          {
            validator: customValidator,
            runOn: 'upload',
          },
        ];
        const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
        const api = ctxProvider.getAPI();
        api.addFileFromObject(IMAGE.PIXEL);
        api.initFlow();
        await expect
          .poll(() => api.getOutputCollectionState().status, {
            timeout: 10000,
          })
          .toBe('success');
        await expect.poll(() => customValidator).toHaveBeenCalledTimes(1);
      });

      it('should not re-run validator on cdnUrl change (e.g. image edit)', async () => {
        const config = page.getByTestId('uc-config').query()! as Config;
        const customValidator = vi.fn(() => undefined);
        config.fileValidators = [
          {
            validator: customValidator,
            runOn: 'add',
          },
        ];
        const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
        const api = ctxProvider.getAPI();
        api.addFileFromObject(IMAGE.SQUARE);
        api.initFlow();
        await page.getByLabelText('Edit', { exact: true }).click({
          timeout: 10000,
        });
        await page.getByLabelText('Apply mirror operation', { exact: true }).click();
        await delay(300);
        await page.getByRole('button', { name: /apply/i }).click();

        expect(customValidator).toHaveBeenCalledTimes(1);
      });
    });

    describe("runOn option is 'change'", () => {
      it('should run validator on every file change when runOn is "change"', async () => {
        const config = page.getByTestId('uc-config').query()! as Config;
        const customValidator = vi.fn(() => undefined);
        config.fileValidators = [
          {
            validator: customValidator,
            runOn: 'change',
          },
        ];
        const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
        const api = ctxProvider.getAPI();
        api.addFileFromObject(IMAGE.PIXEL);
        api.initFlow();
        await expect
          .poll(() => api.getOutputCollectionState().status, {
            timeout: 3000,
          })
          .toBe('success');
        await expect.poll(() => customValidator.mock.calls.length).toBeGreaterThan(1);
      });

      it('should re-run validator on cdnUrl change (e.g. image edit)', async () => {
        const config = page.getByTestId('uc-config').query()! as Config;
        const customValidator = vi.fn(() => undefined);
        config.fileValidators = [
          {
            validator: customValidator,
            runOn: 'change',
          },
        ];
        const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
        const api = ctxProvider.getAPI();
        api.addFileFromObject(IMAGE.SQUARE);
        api.initFlow();
        await page.getByLabelText('Edit', { exact: true }).click();
        await page.getByLabelText('Apply mirror operation', { exact: true }).click();
        const callsBeforeEdit = customValidator.mock.calls.length;
        await page.getByRole('button', { name: /apply/i }).click();
        await expect.poll(() => customValidator.mock.calls.length).toBe(callsBeforeEdit + 1);
      });
    });
  });

  describe('Async file validators', () => {
    it('should show UI error if validator fails', async () => {
      const config = page.getByTestId('uc-config').query()! as Config;
      config.fileValidators = [
        async (file) => {
          await delay(500);
          if (file.name === 'badfile.jpg') {
            return {
              message: 'Bad image',
            };
          }
        },
      ];
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = ctxProvider.getAPI();
      const badFile = new File(['(⌐□_□)'], 'badfile.jpg', { type: 'image/jpeg' });
      api.addFileFromObject(badFile);
      api.initFlow();
      await expect.element(page.getByText('Bad image')).toBeVisible();
      await expect.element(page.getByText('1 error')).toBeVisible();
    });

    it('should skip async validation on timeout', async () => {
      const config = page.getByTestId('uc-config').query()! as Config;
      config.validationTimeout = 100;
      config.fileValidators = [
        async () => {
          await delay(1000);
          return {
            message: 'Bad image',
          };
        },
      ];
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = ctxProvider.getAPI();
      api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await expect.element(page.getByText('1 file uploaded')).toBeVisible();
    });

    it('should skip async validation if it throws an error', async () => {
      const config = page.getByTestId('uc-config').query()! as Config;
      config.fileValidators = [
        async () => {
          await delay(1000);
          throw new Error('Some error');
        },
      ];
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = ctxProvider.getAPI();
      api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await expect.element(page.getByText('1 file uploaded')).toBeVisible();
    });

    it('should abort async validation if file is removed', async () => {
      const config = page.getByTestId('uc-config').query()! as Config;
      const validator = vi.fn(async () => {
        await delay(500);
        return {
          message: 'Bad image',
        };
      });
      config.fileValidators = [validator];
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = ctxProvider.getAPI();
      const entry = api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await delay(100);
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

  describe('Sync file validators', () => {
    it('should show UI error if validator fails', async () => {
      const config = page.getByTestId('uc-config').query()! as Config;
      config.fileValidators = [
        (file) => {
          if (file.name === 'badfile.jpg') {
            return {
              message: 'Bad image',
            };
          }
        },
      ];
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = ctxProvider.getAPI();
      const goodFile = IMAGE.PIXEL;
      api.addFileFromObject(goodFile);
      const badFile = new File(['(⌐□_□)'], 'badfile.jpg', { type: 'image/jpeg' });
      api.addFileFromObject(badFile);
      api.initFlow();
      await expect.element(page.getByText('Bad image')).toBeVisible();
      await expect.element(page.getByLabelText('File pixel.jpg in status finished')).toBeVisible();
    });

    it('should be run multiple times during upload', async () => {
      const config = page.getByTestId('uc-config').query()! as Config;
      const validator = vi.fn(() => undefined);
      config.fileValidators = [validator];
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = ctxProvider.getAPI();
      api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await expect
        .poll(() => validator)
        .toHaveBeenCalledWith(expect.objectContaining({ status: 'idle' }), expect.anything(), expect.anything());
      await expect
        .poll(() => validator, {
          timeout: 10000,
        })
        .toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }), expect.anything(), expect.anything());
    });

    it('should be called when cdnUrl or cdnUrlModifiers changed', async () => {
      const config = page.getByTestId('uc-config').query()! as Config;
      const validator = vi.fn(() => undefined);
      config.fileValidators = [validator];
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
      const api = ctxProvider.getAPI();
      api.addFileFromObject(IMAGE.SQUARE);
      api.initFlow();

      await expect
        .poll(() => validator, {
          timeout: 5000,
        })
        .toHaveBeenLastCalledWith(
          expect.objectContaining({ cdnUrlModifiers: '' }),
          expect.anything(),
          expect.anything(),
        );

      await page.getByLabelText('Edit', { exact: true }).click();
      await delay(1000);
      await page.getByLabelText('Apply mirror operation', { exact: true }).click();
      await delay(1000);
      await page.getByRole('button', { name: /apply/i }).click();

      await expect
        .poll(() => validator, {
          timeout: 5000,
        })
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
});

describe('Custom upload collection validation', () => {
  it('should show UI error if collection validator fails', async () => {
    const config = page.getByTestId('uc-config').query()! as Config;
    config.collectionValidators = [
      () => {
        return {
          message: 'Bad collection',
        };
      },
    ];
    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = ctxProvider.getAPI();
    api.addFileFromObject(IMAGE.PIXEL);
    api.initFlow();
    await expect.element(page.getByText('Bad collection')).toBeVisible();
  });

  it('should toggle UI error while collection changes and re-validation executes', async () => {
    const config = page.getByTestId('uc-config').query()! as Config;
    config.collectionValidators = [
      (collection) => {
        if (collection.totalCount !== 2)
          return {
            message: 'Bad collection',
          };
      },
    ];
    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = ctxProvider.getAPI();
    api.addFileFromObject(IMAGE.PIXEL);
    api.initFlow();
    await expect.element(page.getByText('Bad collection')).toBeVisible();
    api.addFileFromObject(IMAGE.PIXEL);
    await expect.element(page.getByText('Bad collection')).not.toBeInTheDocument();
  });
});

describe('File errors API', () => {
  it('should collect all validation errors in the `errors` property of the file', async () => {
    const config = page.getByTestId('uc-config').query()! as Config;
    config.imgOnly = true;
    config.accept = 'image/png';
    config.maxLocalFileSizeBytes = 1;
    config.fileValidators = [
      () => ({
        message: 'Bad file',
      }),
    ];

    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = ctxProvider.getAPI();
    const badFile = new File(['(⌐□_□)'], 'badfile.txt', { type: 'text/plain' });
    const entry = api.addFileFromObject(badFile);
    api.initFlow();

    await expect
      .poll(() => {
        const currentEntry = api.getOutputItem(entry.internalId);
        return currentEntry.errors;
      })
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining<Partial<OutputErrorFile>>({ type: 'NOT_AN_IMAGE' }),
          expect.objectContaining<Partial<OutputErrorFile>>({
            type: 'FORBIDDEN_FILE_TYPE',
          }),
          expect.objectContaining<Partial<OutputErrorFile>>({ type: 'FILE_SIZE_EXCEEDED' }),
          expect.objectContaining<Partial<OutputErrorFile>>({ type: 'CUSTOM_ERROR' }),
        ]),
      );
  });

  it('should provide upload errors', async () => {
    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = ctxProvider.getAPI();
    const entry = api.addFileFromUrl(`https://fake-domain-that-will-404.com/image.jpg`);
    api.initFlow();
    await expect
      .poll(
        () => {
          const currentEntry = api.getOutputItem(entry.internalId);
          return currentEntry.errors;
        },
        {
          timeout: 5000,
        },
      )
      .toEqual(expect.arrayContaining([expect.objectContaining<Partial<OutputErrorFile>>({ type: 'UPLOAD_ERROR' })]));
  });

  it('should toggle errors in the `errors` property of the file on file change', async () => {
    const config = page.getByTestId('uc-config').query()! as Config;
    const customValidator = vi.fn<FuncFileValidator>((entry) => {
      if (entry.cdnUrlModifiers?.includes('mirror')) {
        return {
          message: 'Bad image',
        };
      }
    });
    config.fileValidators = [
      {
        validator: customValidator,
        runOn: 'change',
      },
    ];
    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = ctxProvider.getAPI();
    const entry = api.addFileFromObject(IMAGE.SQUARE);
    api.initFlow();

    // Apply mirror and check for error
    await page.getByLabelText('Edit', { exact: true }).click();
    await delay(1000);
    await page.getByLabelText('Apply mirror operation', { exact: true }).click();
    await delay(1000);
    await page.getByRole('button', { name: /apply/i }).click();

    await expect
      .poll(() => {
        const currentEntry = api.getOutputItem(entry.internalId);
        return currentEntry.errors;
      })
      .toEqual(expect.arrayContaining([expect.objectContaining<Partial<OutputErrorFile>>({ type: 'CUSTOM_ERROR' })]));

    // Remove mirror and check for error gone
    await page.getByLabelText('Edit', { exact: true }).click();
    await delay(1000);
    await page.getByLabelText('Apply mirror operation', { exact: true }).click();
    await delay(1000);
    await page.getByRole('button', { name: /apply/i }).click();

    await expect
      .poll(() => {
        const currentEntry = api.getOutputItem(entry.internalId);
        return currentEntry.errors;
      })
      .toEqual([]);

    // Apply mirror and check for error again
    await page.getByLabelText('Edit', { exact: true }).click();
    await delay(1000);
    await page.getByLabelText('Apply mirror operation', { exact: true }).click();
    await delay(1000);
    await page.getByRole('button', { name: /apply/i }).click();

    await expect
      .poll(() => {
        const currentEntry = api.getOutputItem(entry.internalId);
        return currentEntry.errors;
      })
      .toEqual(expect.arrayContaining([expect.objectContaining<Partial<OutputErrorFile>>({ type: 'CUSTOM_ERROR' })]));
  }, 20000);

  it('should provide errors for "add" and "change" validators', async () => {
    const config = page.getByTestId('uc-config').query()! as Config;
    config.fileValidators = [
      {
        runOn: 'add',
        validator: () => ({
          message: 'Add error',
        }),
      },
      {
        runOn: 'change',
        validator: () => ({
          message: 'Change error',
        }),
      },
    ];
    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = ctxProvider.getAPI();
    const entry = api.addFileFromObject(IMAGE.SQUARE);
    api.initFlow();

    await expect
      .poll(
        () => {
          const currentEntry = api.getOutputItem(entry.internalId);
          return currentEntry.errors;
        },
        {
          timeout: 3000,
        },
      )
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining<Partial<OutputErrorFile>>({ message: 'Add error' }),
          expect.objectContaining<Partial<OutputErrorFile>>({ message: 'Change error' }),
        ]),
      );
  });
});

describe('Upload collection errors API', () => {
  it('should populate upload collection errors with the the common file validation error', async () => {
    const config = page.getByTestId('uc-config').query()! as Config;
    config.fileValidators = [
      () => ({
        message: 'Bad file',
      }),
    ];
    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const api = ctxProvider.getAPI();
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
