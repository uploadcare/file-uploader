import { expect, test } from 'vitest';
import { uploadAndEdit, type WebBundle } from '~/tests/utils/web-bundle-flow';

test('web/file-uploader.iife.min.js uploads a file and edits it', async () => {
  // biome-ignore lint/suspicious/noTsIgnore: Ignoring TypeScript error for CSS import
  // @ts-ignore
  await import('~/web/uc-basic.min.css');
  const { default: scriptUrl } = await import('~/web/file-uploader.iife.min.js?url');
  const script = document.createElement('script');
  script.src = scriptUrl;
  document.head.appendChild(script);
  await new Promise((resolve) => {
    script.onload = resolve;
  });

  // The IIFE's global, typed as the ESM build it is built from.
  const { UC } = globalThis as { UC?: WebBundle };
  expect(UC).toBeDefined();
  if (UC) await uploadAndEdit(UC);
});
