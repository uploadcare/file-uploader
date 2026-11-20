import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';

// The `web/` bundle, Lit included, minified and with every `_` property mangled together. The e2e suite runs the
// sources, so a mangled name that breaks the bundle only shows here.
const bundle = resolve(import.meta.dirname, '../../web/file-uploader.min.js');

type Block = HTMLElement & { updateComplete: Promise<boolean> };

test('the web bundle renders the inline uploader', async () => {
  const UC = await import(pathToFileURL(bundle).href);
  UC.defineComponents(UC);

  document.body.innerHTML = `
    <uc-config ctx-name="web" pubkey="demopublickey"></uc-config>
    <uc-file-uploader-inline ctx-name="web"></uc-file-uploader-inline>
    <uc-upload-ctx-provider ctx-name="web"></uc-upload-ctx-provider>`;

  // `<uc-start-from>` renders its sources from an array, the value a mangled name that collides with an array's
  // native property breaks.
  await expect.poll(() => document.querySelector('uc-start-from')).not.toBeNull();
  const startFrom = document.querySelector('uc-start-from') as Block;
  await startFrom.updateComplete;

  await expect.poll(() => startFrom.querySelector('button')).not.toBeNull();
});
