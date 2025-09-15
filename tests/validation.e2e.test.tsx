import { page } from '@vitest/browser/context';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '../types/jsx';
import { renderer } from './utils/test-renderer';
import type { UploadCtxProvider } from '@/index';
import { IMAGE } from './fixtures/files';
import { delay } from '@/utils/delay';

beforeAll(async () => {
  await import('@/solutions/file-uploader/regular/index.css');
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

beforeEach(() => {
  const ctxName = `test-${Math.random().toString(36).slice(2)}`;
  page.render(
    <>
      <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
      <uc-config ctx-name={ctxName} testMode pubkey="demopublickey"></uc-config>
      <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
    </>,
  );
});

describe('Common validation', () => {
  describe('imgOnly', () => {
    it('should show UI error if non-image file is uploaded', async () => {
      const config = page.getByTestId('uc-config').query()! as InstanceType<Config>;
      config.imgOnly = true;
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as InstanceType<typeof UploadCtxProvider>;
      const api = ctxProvider.getAPI();
      const file = new File(['(⌐□_□)'], 'chucknorris.txt', { type: 'text/plain' });
      api.addFileFromObject(file);
      api.initFlow();
      await expect.element(page.getByText('Only image files are accepted')).toBeVisible();
    });
  });

  describe('accept', () => {
    it('should show UI error if non-accepted file is uploaded', async () => {
      const config = page.getByTestId('uc-config').query()! as InstanceType<Config>;
      config.accept = 'image/png';
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as InstanceType<typeof UploadCtxProvider>;
      const api = ctxProvider.getAPI();
      const file = new File(['(⌐□_□)'], 'chucknorris.jpg', { type: 'image/jpeg' });
      api.addFileFromObject(file);
      api.initFlow();
      await expect.element(page.getByText('Uploading of these file types is not allowed')).toBeVisible();
    });
  });

  describe('maxLocalFileSizeBytes', () => {
    it('should show UI error if file is too large', async () => {
      const config = page.getByTestId('uc-config').query()! as InstanceType<Config>;
      config.maxLocalFileSizeBytes = 1024;
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as InstanceType<typeof UploadCtxProvider>;
      const api = ctxProvider.getAPI();
      const file = new File([new ArrayBuffer(2048)], 'largefile.jpg', { type: 'image/jpeg' });
      api.addFileFromObject(file);
      api.initFlow();
      await expect.element(page.getByText('File is too big')).toBeVisible();
    });
  });

  describe('server-side validation', () => {
    it('should show UI error if server rejects the file', async () => {
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as InstanceType<typeof UploadCtxProvider>;
      const api = ctxProvider.getAPI();
      api.addFileFromUrl(`https://fake-domain-that-will-404.com/image.jpg`);
      api.initFlow();
      await expect.element(page.getByText('Host does not exist')).toBeVisible();
    });
  });

  describe('multiple', () => {
    it('should show UI error if multiple files are added when multiple is false', async () => {
      const config = page.getByTestId('uc-config').query()! as InstanceType<Config>;
      config.multiple = false;
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as InstanceType<typeof UploadCtxProvider>;
      const api = ctxProvider.getAPI();
      api.addFileFromObject(IMAGE.PIXEL);
      api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await expect.element(page.getByText(`You’ve chosen too many files`)).toBeVisible();
    });

    it('should show UI error if more than multipleMax files are added', async () => {
      const config = page.getByTestId('uc-config').query()! as InstanceType<Config>;
      config.multipleMax = 2;
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as InstanceType<typeof UploadCtxProvider>;
      const api = ctxProvider.getAPI();
      api.addFileFromObject(IMAGE.PIXEL);
      api.addFileFromObject(IMAGE.PIXEL);
      api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await expect.element(page.getByText(`You’ve chosen too many files`)).toBeVisible();
    });

    it('should show UI error if less than multipleMin files are added', async () => {
      const config = page.getByTestId('uc-config').query()! as InstanceType<Config>;
      config.multipleMin = 2;
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as InstanceType<typeof UploadCtxProvider>;
      const api = ctxProvider.getAPI();
      api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await expect.element(page.getByText(`At least 2 files required`)).toBeVisible();
    });
  });
});

describe('Custom validation', () => {
  describe('fileValidators/sync', () => {
    it('should show UI error if validator fails', async () => {
      const config = page.getByTestId('uc-config').query()! as InstanceType<Config>;
      config.fileValidators = [
        (file) => {
          if (file.name === 'badfile.jpg') {
            return {
              message: 'Bad image',
            };
          }
        },
      ];
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as InstanceType<typeof UploadCtxProvider>;
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
      const config = page.getByTestId('uc-config').query()! as InstanceType<Config>;
      const validator = vi.fn(() => undefined);
      config.fileValidators = [validator];
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as InstanceType<typeof UploadCtxProvider>;
      const api = ctxProvider.getAPI();
      api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await expect
        .poll(() => validator, {
          timeout: 3000,
        })
        .toHaveBeenCalledTimes(3);

      expect(validator).toHaveBeenNthCalledWith(1, expect.objectContaining({ status: 'idle' }), expect.anything());
      expect(validator).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: 'uploading' }), expect.anything());
      expect(validator).toHaveBeenNthCalledWith(3, expect.objectContaining({ status: 'success' }), expect.anything());
    });

    it('should not be called if previous validation iteration is failed', async () => {
      const config = page.getByTestId('uc-config').query()! as InstanceType<Config>;
      config.fileValidators = [
        (fileInfo) => {
          if (fileInfo.status === 'idle') {
            return {
              message: 'Bad file',
            };
          }
        },
      ];
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as InstanceType<typeof UploadCtxProvider>;
      const api = ctxProvider.getAPI();
      api.addFileFromObject(IMAGE.PIXEL);
      api.initFlow();
      await expect.element(page.getByText('Bad file')).toBeVisible();
    });

    it.only('should be called when cdnUrl or cdnUrlModifiers changed', async () => {
      const config = page.getByTestId('uc-config').query()! as InstanceType<Config>;
      const validator = vi.fn(() => undefined);
      config.fileValidators = [validator];
      const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as InstanceType<typeof UploadCtxProvider>;
      const api = ctxProvider.getAPI();
      api.addFileFromObject(IMAGE.SQUARE);
      api.initFlow();

      console.log(validator.mock.calls);
      await expect
        .poll(() => validator, {
          timeout: 3000,
        })
        .toHaveBeenLastCalledWith(expect.objectContaining({ cdnUrlModifiers: '' }), expect.anything());

      await page.getByLabelText('Edit', { exact: true }).click();
      await page.getByLabelText('Apply mirror operation', { exact: true }).click();
      await delay(300);
      await page.getByLabelText('apply', { exact: true }).click();

      await expect
        .poll(() => validator)
        .toHaveBeenLastCalledWith(
          expect.objectContaining({
            cdnUrlModifiers: '-/mirror/-/preview/',
            cdnUrl: expect.stringContaining('-/mirror/-/preview/'),
          }),
          expect.anything(),
        );
    });
  });
});

describe('Upload list validation', () => {
  it('should show UI error if list validator fails', async () => {
    const config = page.getByTestId('uc-config').query()! as InstanceType<Config>;
    config.collectionValidators = [
      () => {
        return {
          message: 'Bad collection',
        };
      },
    ];
    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as InstanceType<typeof UploadCtxProvider>;
    const api = ctxProvider.getAPI();
    api.addFileFromObject(IMAGE.PIXEL);
    api.initFlow();
    await expect.element(page.getByText('Bad collection')).toBeVisible();
  });

  it('should toggle UI error while list changes and re-validation executes', async () => {
    const config = page.getByTestId('uc-config').query()! as InstanceType<Config>;
    config.collectionValidators = [
      (collection) => {
        if (collection.totalCount !== 2)
          return {
            message: 'Bad collection',
          };
      },
    ];
    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as InstanceType<typeof UploadCtxProvider>;
    const api = ctxProvider.getAPI();
    api.addFileFromObject(IMAGE.PIXEL);
    api.initFlow();
    await expect.element(page.getByText('Bad collection')).toBeVisible();
    api.addFileFromObject(IMAGE.PIXEL);
    await expect.element(page.getByText('Bad collection')).not.toBeInTheDocument();
  });
});
