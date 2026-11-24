import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, test } from 'vitest';

// `<uc-uploader>` is undocumented in 1.x; registering it would collide with an app's own `uc-uploader`.
const bundles = [
  'file-uploader.min.js',
  'uc-file-uploader-regular.min.js',
  'uc-file-uploader-minimal.min.js',
  'uc-file-uploader-inline.min.js',
];

describe('hidden <uc-uploader>', () => {
  test('the root entry does not export Uploader', async () => {
    const rootModule = await import('@uploadcare/file-uploader');
    expect(rootModule).not.toHaveProperty('Uploader');
  });

  test.each(bundles)('web/%s neither exports Uploader nor registers uc-uploader', async (bundle) => {
    const UC = await import(pathToFileURL(resolve(import.meta.dirname, `../../web/${bundle}`)).href);
    expect(UC).not.toHaveProperty('Uploader');
    UC.defineComponents(UC);
    expect(customElements.get('uc-file-uploader-regular')).toBeDefined();
    expect(customElements.get('uc-uploader')).toBeUndefined();
  });
});
