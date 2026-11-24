import { test } from 'vitest';
import { uploadAndEdit } from '~/tests/utils/web-bundle-flow';

test('web/file-uploader.min.js uploads a file and edits it', async () => {
  // biome-ignore lint/suspicious/noTsIgnore: Ignoring TypeScript error for CSS import
  // @ts-ignore
  await import('~/web/uc-basic.min.css');
  await uploadAndEdit(await import('~/web/file-uploader.min.js'));
});
