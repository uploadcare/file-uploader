import { afterEach, beforeAll, beforeEach } from 'vitest';
import { commands, page } from 'vitest/browser';
import type { UploadCtxProvider } from '@/index';
import '~/tests/utils/test-renderer';

/** Answers every third-party request from the fake Uploadcare, with nothing left over from the last test. */
beforeEach(async () => {
  await commands.useFakeNetwork();
});

/** Registers every custom element once per file, so no spec has to. `<uc-img>` ships from its own entry. */
beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
  await import('@/solutions/adaptive-image/index.js');
});

/** Uploads keep running after a test ends; drop them so they cannot leak events into the next one. */
afterEach(() => {
  for (const provider of page.getByTestId('uc-upload-ctx-provider').elements() as UploadCtxProvider[]) {
    provider.api.removeAllFiles();
  }
});
