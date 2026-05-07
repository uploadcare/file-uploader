import { describe, expect, test } from 'vitest';

const stickyPackageVersion = (obj: any) => {
  if ('PACKAGE_VERSION' in obj) {
    return {
      ...obj,
      PACKAGE_VERSION: '0.0.0-stub',
    };
  }
  return obj;
};

describe('NPM package', () => {
  test('import asserts are working', async () => {
    await expect(import(`@uploadcare/file-uploader/${'abstract/Block.js'}`)).rejects.toThrow();
  });

  test('root ssr stubs export should match snapshot', async () => {
    const rootModule = await import('@uploadcare/file-uploader');
    expect('IS_SSR_STUBS' in rootModule).toBe(true);
    expect(stickyPackageVersion(rootModule)).toMatchSnapshot('root export');
  });

  test('export `abstract/loadFileUploaderFrom.js` should match snapshot', async () => {
    const loadFileUploaderFrom = await import('@uploadcare/file-uploader/abstract/loadFileUploaderFrom.js');
    expect(stickyPackageVersion(loadFileUploaderFrom)).toMatchSnapshot('abstract/loadFileUploaderFrom.js');
  });

  test('export `env` should match snapshot', async () => {
    const env = await import('@uploadcare/file-uploader/env');
    expect(stickyPackageVersion(env)).toMatchSnapshot('env');
  });

  test('exports `web` should match snapshot', async () => {
    const webBundles = [
      'file-uploader.iife.min.js',
      'file-uploader.min.js',
      'uc-basic.min.css',
      'uc-cloud-image-editor.min.css',
      'uc-cloud-image-editor.min.js',
      'uc-file-uploader-inline.min.css',
      'uc-file-uploader-inline.min.js',
      'uc-file-uploader-minimal.min.css',
      'uc-file-uploader-minimal.min.js',
      'uc-file-uploader-regular.min.css',
      'uc-file-uploader-regular.min.js',
      'uc-img.min.js',
    ];

    for (const bundle of webBundles) {
      let m: unknown;
      try {
        m = await import(`@uploadcare/file-uploader/web/${bundle}`);
      } catch (error) {
        // Vite@4 can't dynamically import css files
        // Here we're just want to ensure that the css file exists and is importable
        // In that case we receive specific error which we can safely ignore
        if (error instanceof Error && 'code' in error && error.code === 'ERR_UNKNOWN_FILE_EXTENSION') {
          m = { default: '' };
        }
      }
      expect(stickyPackageVersion(m)).toMatchSnapshot(`web/${bundle}`);
    }
  });

  test('jsx types should be exported', async () => {
    await expect(
      // @ts-expect-error
      import('@uploadcare/file-uploader/types/jsx'),
    ).resolves.not.toThrow();
  });

  test('locales should be exported', async () => {
    await expect(import('@uploadcare/file-uploader/locales/file-uploader/en.js')).resolves.not.toThrow();
  });
});
